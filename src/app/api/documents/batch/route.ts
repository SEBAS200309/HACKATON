import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ZipArchive } from 'archiver';
import { storageService } from '@/services/storageService';
import { documentGenerationService } from '@/services/documentGenerationService';
import type {
  ApiErrorResponse,
  TemplateMetadata,
  BatchGenerateRequest,
  BatchGenerateResponse,
} from '@/types';

function createErrorResponse(
  code: string,
  message: string,
  status: number,
  retryable: boolean = false
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message, retryable } },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, xlsxTemplateId, records } = body as BatchGenerateRequest;

    // Validar campos requeridos
    if (!templateId || !records || !Array.isArray(records) || records.length === 0) {
      return createErrorResponse(
        'BATCH_FAILED',
        'Faltan campos requeridos: templateId y records (al menos un registro) son obligatorios',
        400
      );
    }

    // Obtener metadata de plantillas desde templates/index.json
    const templatesIndex = (await storageService.getJsonIndex('templates')) as TemplateMetadata[];
    const wordTemplate = templatesIndex.find((t) => t.id === templateId);

    if (!wordTemplate) {
      return createErrorResponse(
        'BATCH_FAILED',
        'La plantilla Word especificada no fue encontrada',
        400
      );
    }

    let xlsxTemplate: TemplateMetadata | undefined;
    if (xlsxTemplateId) {
      xlsxTemplate = templatesIndex.find((t) => t.id === xlsxTemplateId);
      if (!xlsxTemplate) {
        return createErrorResponse(
          'BATCH_FAILED',
          'La plantilla Excel especificada no fue encontrada',
          400
        );
      }
    }

    const batchId = uuidv4();
    const batchPrefix = `generated/batch/${batchId}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const templateName = wordTemplate.fileName.replace(/\.[^/.]+$/, '');

    const generatedFiles: BatchGenerateResponse['files'] = [];
    const errors: BatchGenerateResponse['errors'] = [];

    // Generar un .docx por cada record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const docxBuffer = await documentGenerationService.fillWordTemplate(
          wordTemplate.s3Key,
          record
        );

        const docId = uuidv4();
        const docxFileName = `${templateName}_${dateStr}_${i + 1}.docx`;
        const docxS3Key = `${batchPrefix}/${docxFileName}`;

        await storageService.putObject(
          docxS3Key,
          docxBuffer,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );

        const downloadUrl = await storageService.getPresignedDownloadUrl(docxS3Key, 3600);

        generatedFiles.push({
          id: docId,
          fileName: docxFileName,
          downloadUrl,
          type: 'docx',
        });
      } catch (error) {
        errors.push({
          recordIndex: i,
          message: `Error al generar documento para el registro ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        });
      }
    }

    // Si todos los records fallaron, retornar error completo
    if (generatedFiles.length === 0) {
      return createErrorResponse(
        'BATCH_FAILED',
        'Error al generar el lote completo. Ningún documento pudo ser generado',
        500,
        true
      );
    }

    // Generar XLSX acumulativo si se proporcionó xlsxTemplateId
    let xlsxBuffer: Buffer | null = null;
    if (xlsxTemplate) {
      try {
        // Generar XLSX secuencialmente para acumular filas
        let currentBuffer: Buffer | null = null;
        for (let i = 0; i < records.length; i++) {
          // Saltar records que fallaron en la generación DOCX
          if (errors.some((e) => e.recordIndex === i)) {
            continue;
          }

          try {
            // Para la primera iteración usar la plantilla original,
            // para las siguientes usar el buffer acumulado
            const sourceKey = currentBuffer
              ? `${batchPrefix}/_temp_xlsx.xlsx`
              : xlsxTemplate.s3Key;

            if (currentBuffer) {
              await storageService.putObject(
                sourceKey,
                currentBuffer,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              );
            }

            currentBuffer = await documentGenerationService.fillXlsxTemplate(
              sourceKey,
              records[i]
            );
          } catch {
            // Si falla un registro en XLSX, continuar con los demás
            errors.push({
              recordIndex: i,
              message: `Error al agregar registro ${i + 1} a la hoja Excel`,
            });
          }
        }

        xlsxBuffer = currentBuffer;

        if (xlsxBuffer) {
          const xlsxFileName = `${templateName}_${dateStr}.xlsx`;
          const xlsxS3Key = `${batchPrefix}/${xlsxFileName}`;

          await storageService.putObject(
            xlsxS3Key,
            xlsxBuffer,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );

          const xlsxDownloadUrl = await storageService.getPresignedDownloadUrl(xlsxS3Key, 3600);

          generatedFiles.push({
            id: uuidv4(),
            fileName: xlsxFileName,
            downloadUrl: xlsxDownloadUrl,
            type: 'xlsx',
          });
        }
      } catch (error) {
        // XLSX generation failed entirely but DOCX files are still valid
        errors.push({
          recordIndex: -1,
          message: `Error al generar la hoja Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        });
      }
    }

    // Empaquetar todo en ZIP usando archiver
    const zipFileName = `${templateName}_${dateStr}_lote.zip`;
    const zipS3Key = `${batchPrefix}/${zipFileName}`;

    const zipBuffer = await createZipBuffer(generatedFiles, batchPrefix, xlsxBuffer);

    await storageService.putObject(
      zipS3Key,
      zipBuffer,
      'application/zip'
    );

    const zipDownloadUrl = await storageService.getPresignedDownloadUrl(zipS3Key, 3600);

    // Determinar status HTTP
    const httpStatus = errors.length > 0 ? 207 : 200;
    const response: BatchGenerateResponse = {
      files: generatedFiles,
      zipDownloadUrl,
      errors,
    };

    return NextResponse.json(response, { status: httpStatus });
  } catch {
    return createErrorResponse(
      'BATCH_FAILED',
      'Error al generar el lote de documentos. Intente nuevamente',
      500,
      true
    );
  }
}

/**
 * Crea un buffer ZIP con todos los archivos generados del batch.
 */
async function createZipBuffer(
  files: BatchGenerateResponse['files'],
  batchPrefix: string,
  xlsxBuffer: Buffer | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err: Error) => reject(err));

    // Agregar archivos al ZIP de forma asíncrona
    const addFiles = async () => {
      try {
        for (const file of files) {
          if (file.type === 'docx') {
            const s3Key = `${batchPrefix}/${file.fileName}`;
            const fileBuffer = await storageService.getObject(s3Key);
            archive.append(fileBuffer, { name: file.fileName });
          }
        }

        // Agregar XLSX si existe
        if (xlsxBuffer) {
          const xlsxFile = files.find((f) => f.type === 'xlsx');
          if (xlsxFile) {
            archive.append(xlsxBuffer, { name: xlsxFile.fileName });
          }
        }

        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    };

    addFiles();
  });
}
