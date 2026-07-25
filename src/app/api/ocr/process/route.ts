import { NextResponse } from 'next/server';
import { ocrService } from '@/services/tesseractOcrService';
import type { ApiErrorResponse, AreaOfInterest } from '@/types';

const OCR_TIMEOUT_MS = 60_000; // 60 segundos

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
    const { documentKey, areas } = body as {
      documentKey?: string;
      areas?: AreaOfInterest[];
    };

    // Validar campos requeridos
    if (!documentKey || !areas) {
      return createErrorResponse(
        'OCR_FAILED',
        'Faltan campos requeridos: documentKey y areas son obligatorios',
        400
      );
    }

    // Validate documentKey is a sources/ path with no traversal
    if (!documentKey.startsWith('sources/') || documentKey.includes('..')) {
      return createErrorResponse(
        'OCR_FAILED',
        'La clave del documento no es válida',
        400
      );
    }

    // Validar que areas sea un array no vacío
    if (!Array.isArray(areas) || areas.length === 0) {
      return createErrorResponse(
        'OCR_FAILED',
        'El campo areas debe ser un array no vacío',
        400
      );
    }

    // Validate each area has required fields
    for (const area of areas) {
      if (
        typeof area.x !== 'number' || typeof area.y !== 'number' ||
        typeof area.width !== 'number' || typeof area.height !== 'number' ||
        !area.variableName || typeof area.variableName !== 'string' ||
        area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0 ||
        area.x + area.width > 1.01 || area.y + area.height > 1.01
      ) {
        return createErrorResponse(
          'OCR_FAILED',
          'Las áreas contienen valores inválidos. Las coordenadas deben estar entre 0 y 1',
          400
        );
      }
    }

    // Ejecutar OCR con timeout de 60 segundos
    const ocrPromise = ocrService.processDocument(documentKey, areas);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('OCR_TIMEOUT'));
      }, OCR_TIMEOUT_MS);
    });

    const results = await Promise.race([ocrPromise, timeoutPromise]);

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Timeout
    if (errorMessage === 'OCR_TIMEOUT' || errorMessage.includes('tiempo límite')) {
      return createErrorResponse(
        'OCR_TIMEOUT',
        'El procesamiento OCR tardó demasiado. Intente con una imagen de menor resolución',
        504,
        true
      );
    }

    // Error de inicialización
    if (errorMessage.includes('no se pudo inicializar')) {
      return createErrorResponse(
        'OCR_INIT_FAILED',
        'Error al inicializar el motor OCR. Intente nuevamente en unos segundos',
        503,
        true
      );
    }

    // Error genérico de OCR
    console.error('OCR processing error:', errorMessage);
    return createErrorResponse(
      'OCR_FAILED',
      'Error en el procesamiento OCR. Verifique la calidad del documento e intente nuevamente',
      502,
      true
    );
  }
}
