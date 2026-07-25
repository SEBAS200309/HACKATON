import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
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

    // Limit records to prevent DoS
    const MAX_BATCH_RECORDS = 100;
    if (records.length > MAX_BATCH_RECORDS) {
      return createErrorResponse(
        'BATCH_FAILED',
        `El lote excede el máximo de ${MAX_BATCH_RECORDS} registros`,
        400
      );
    }

    // Obtener metadata de plantillas desde templates/index.json
    const templatesIndex = (await storageService.getJsonIndex('templates')) as TemplateMetadata[];

    // Buscar la plantilla principal por templateId y verificar su tipo
    const primaryTemplate = templatesIndex.find((t) => t.id === templateId);

    if (!primaryTemplate) {
      return createErrorResponse(
        'BATCH_FAILED',
        'La plantilla especificada no fue encontrada',
        400
      );
    }

    // Determinar el escenario según el tipo de la plantilla principal
    const isWordPrimary = primaryTemplate.type === 'word';
    const isXlsxPrimary = primaryTemplate.type === 'xlsx';

    // Resolver plantilla XLSX secundaria (solo aplica si primary es Word)
    let secondaryXlsxTemplate: TemplateMetadata | undefined;
    if (isWordPrimary && xlsxTemplateId) {
      secondaryXlsxTemplate = templatesIndex.find((t) => t.id === xlsxTemplateId);
      if (!secondaryXlsxTemplate) {
        return createErrorResponse(
          'BATCH_FAILED',
          'La plantilla Excel secundaria especificada no fue encontrada',
          400
        );
      }
    }

    const batchId = uuidv4();
    const batchPrefix = `generated/batch/${batchId}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const templateName = primaryTemplate.fileName.replace(/\.[^/.]+$/, '');

    const generatedFiles: BatchGenerateResponse['files'] = [];
    const errors: BatchGenerateResponse['errors'] = [];

    // ─── Escenario 1: Word only (o Word + XLSX secundario) ─────────────────────
    if (isWordPrimary) {
      // Generar un .docx por cada record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          const docxBuffer = await documentGenerationService.fillWordTemplate(
            primaryTemplate.s3Key,
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

      // Generar XLSX acumulativo si se proporcionó xlsxTemplateId secundario
      if (secondaryXlsxTemplate) {
        try {
          let currentBuffer: Buffer | null = null;
          for (let i = 0; i < records.length; i++) {
            // Saltar records que fallaron en la generación DOCX
            if (errors.some((e) => e.recordIndex === i)) {
              continue;
            }

            try {
              const sourceKey = currentBuffer
                ? `${batchPrefix}/_temp_xlsx.xlsx`
                : secondaryXlsxTemplate.s3Key;

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
              errors.push({
                recordIndex: i,
                message: `Error al agregar registro ${i + 1} a la hoja Excel`,
              });
            }
          }

          if (currentBuffer) {
            const xlsxFileName = `${templateName}_${dateStr}.xlsx`;
            const xlsxS3Key = `${batchPrefix}/${xlsxFileName}`;

            await storageService.putObject(
              xlsxS3Key,
              currentBuffer,
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
          errors.push({
            recordIndex: -1,
            message: `Error al generar la hoja Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          });
        }
      }
    }

    // ─── Escenario 2: Excel only (templateId apunta a una plantilla xlsx) ──────
    if (isXlsxPrimary) {
      try {
        let currentBuffer: Buffer | null = null;
        for (let i = 0; i < records.length; i++) {
          try {
            const sourceKey = currentBuffer
              ? `${batchPrefix}/_temp_xlsx.xlsx`
              : primaryTemplate.s3Key;

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
            errors.push({
              recordIndex: i,
              message: `Error al agregar registro ${i + 1} a la hoja Excel`,
            });
          }
        }

        if (currentBuffer) {
          const xlsxFileName = `${templateName}_${dateStr}.xlsx`;
          const xlsxS3Key = `${batchPrefix}/${xlsxFileName}`;

          await storageService.putObject(
            xlsxS3Key,
            currentBuffer,
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
        errors.push({
          recordIndex: -1,
          message: `Error al generar la hoja Excel: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        });
      }
    }

    // ─── Verificar que al menos un archivo fue generado ────────────────────────
    if (generatedFiles.length === 0) {
      return createErrorResponse(
        'BATCH_FAILED',
        'Error al generar el lote completo. Ningún documento pudo ser generado',
        500,
        true
      );
    }

    // ─── Empaquetar en ZIP ─────────────────────────────────────────────────────
    const zipFileName = `${templateName}_${dateStr}_lote.zip`;
    const zipS3Key = `${batchPrefix}/${zipFileName}`;

    const zipBuffer = await createZipBuffer(generatedFiles, batchPrefix);

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
  batchPrefix: string
): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    const s3Key = `${batchPrefix}/${file.fileName}`;
    const fileBuffer = await storageService.getObject(s3Key);
    zip.file(file.fileName, fileBuffer);
  }

  const zipUint8Array = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  return Buffer.from(zipUint8Array);
}
