import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '@/services/storageService';
import { documentGenerationService } from '@/services/documentGenerationService';
import type { ApiErrorResponse, TemplateMetadata, GeneratedDocument } from '@/types';

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
    const { templateId, xlsxTemplateId, variables, sourceDocumentKey } = body as {
      templateId?: string;
      xlsxTemplateId?: string;
      variables?: Record<string, string>;
      sourceDocumentKey?: string;
    };

    // Validar campos requeridos
    if (!templateId || !variables || !sourceDocumentKey) {
      return createErrorResponse(
        'GENERATION_FAILED',
        'Faltan campos requeridos: templateId, variables y sourceDocumentKey son obligatorios',
        400
      );
    }

    // Obtener metadata de la plantilla Word desde templates/index.json
    const templatesIndex = (await storageService.getJsonIndex('templates')) as TemplateMetadata[];
    const template = templatesIndex.find((t) => t.id === templateId);

    if (!template) {
      return createErrorResponse(
        'GENERATION_FAILED',
        'La plantilla Word especificada no fue encontrada',
        400
      );
    }

    // Generar el documento Word completado
    let docxBuffer: Buffer;
    try {
      docxBuffer = await documentGenerationService.fillWordTemplate(template.s3Key, variables);
    } catch {
      return createErrorResponse(
        'GENERATION_FAILED',
        'Error al generar el documento. Intente nuevamente',
        502,
        true
      );
    }

    // Generar ID único para el documento generado
    const documentId = uuidv4();

    // Crear nombre de archivo: {templateName}_{YYYY-MM-DD}.docx
    const templateName = template.fileName.replace(/\.[^/.]+$/, '');
    const generatedAt = new Date().toISOString();
    const dateStr = generatedAt.slice(0, 10); // YYYY-MM-DD
    const docxFilename = `${templateName}_${dateStr}.docx`;

    // Almacenar .docx generado en S3
    const docxKey = `generated/${documentId}.docx`;
    await storageService.putObject(
      docxKey,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    // Procesar plantilla XLSX si se proporcionó
    let xlsxKey: string | undefined;
    let xlsxFilename: string | undefined;
    let xlsxDownloadUrl: string | undefined;

    if (xlsxTemplateId) {
      const xlsxTemplate = templatesIndex.find((t) => t.id === xlsxTemplateId);

      if (!xlsxTemplate) {
        return createErrorResponse(
          'XLSX_FAILED',
          'La plantilla Excel especificada no fue encontrada',
          400
        );
      }

      let xlsxBuffer: Buffer;
      try {
        xlsxBuffer = await documentGenerationService.fillXlsxTemplate(xlsxTemplate.s3Key, variables);
      } catch {
        return createErrorResponse(
          'XLSX_FAILED',
          'Error al completar la plantilla Excel. Intente nuevamente',
          502,
          true
        );
      }

      xlsxKey = `generated/${documentId}.xlsx`;
      const xlsxTemplateName = xlsxTemplate.fileName.replace(/\.[^/.]+$/, '');
      xlsxFilename = `${xlsxTemplateName}_${dateStr}.xlsx`;

      await storageService.putObject(
        xlsxKey,
        xlsxBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    }

    // Actualizar generated/index.json con metadata del documento generado
    const generatedIndex = (await storageService.getJsonIndex('generated')) as GeneratedDocument[];
    const generatedDocument: GeneratedDocument = {
      id: documentId,
      templateId,
      sourceDocumentKey,
      generatedDocxKey: docxKey,
      generatedXlsxKey: xlsxKey,
      variables,
      confidenceScores: {},
      createdAt: generatedAt,
    };
    generatedIndex.push(generatedDocument);
    await storageService.updateJsonIndex('generated', generatedIndex);

    // Generar URLs de descarga con expiración de 1 hora
    const docxDownloadUrl = await storageService.getPresignedDownloadUrl(docxKey, 3600);

    if (xlsxKey) {
      xlsxDownloadUrl = await storageService.getPresignedDownloadUrl(xlsxKey, 3600);
    }

    return NextResponse.json({
      documentId,
      filename: docxFilename,
      docxDownloadUrl,
      xlsxDownloadUrl: xlsxDownloadUrl || null,
      xlsxFilename: xlsxFilename || null,
      generatedAt,
    }, { status: 200 });
  } catch {
    return createErrorResponse(
      'GENERATION_FAILED',
      'Error al generar el documento. Intente nuevamente',
      502,
      true
    );
  }
}
