import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '@/services/storageService';
import type { ApiErrorResponse, SaveSessionRequest, WorkspacePage } from '@/types';

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
    const { templateId, xlsxTemplateId, pages } = body as SaveSessionRequest;

    // Validar campos requeridos
    if (!templateId) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'El campo templateId es obligatorio',
        400
      );
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'El campo pages es obligatorio y debe ser un arreglo no vacío',
        400
      );
    }

    // Generar sessionId único
    const sessionId = uuidv4();
    const savedAt = new Date().toISOString();

    // Construir objeto de sesión
    const sessionData = {
      templateId,
      xlsxTemplateId,
      pages,
      savedAt,
    };

    // Guardar sesión en S3 como JSON
    const sessionKey = `sessions/${sessionId}.json`;
    const sessionBuffer = Buffer.from(JSON.stringify(sessionData, null, 2), 'utf-8');
    await storageService.putObject(sessionKey, sessionBuffer, 'application/json');

    return NextResponse.json({ success: true, sessionId }, { status: 201 });
  } catch {
    return createErrorResponse(
      'SESSION_SAVE_FAILED',
      'Error al guardar la sesión. Intente nuevamente',
      500,
      true
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'El parámetro sessionId es obligatorio',
        400
      );
    }

    const sessionKey = `sessions/${sessionId}.json`;

    let sessionBuffer: Buffer;
    try {
      sessionBuffer = await storageService.getObject(sessionKey);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('no existe') || error.message.includes('NoSuchKey'))
      ) {
        return createErrorResponse(
          'SESSION_NOT_FOUND',
          'La sesión solicitada no fue encontrada',
          404,
          false
        );
      }
      throw error;
    }

    const session = JSON.parse(sessionBuffer.toString('utf-8')) as {
      templateId: string;
      xlsxTemplateId?: string;
      pages: WorkspacePage[];
      savedAt: string;
    };

    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    // Si ya se retornó un error específico (SESSION_NOT_FOUND), no llegar aquí
    if (error instanceof Error && error.message.includes('no existe')) {
      return createErrorResponse(
        'SESSION_NOT_FOUND',
        'La sesión solicitada no fue encontrada',
        404,
        false
      );
    }

    return createErrorResponse(
      'SESSION_RESTORE_FAILED',
      'Error al restaurar la sesión. Intente nuevamente',
      500,
      true
    );
  }
}
