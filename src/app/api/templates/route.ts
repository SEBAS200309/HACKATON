import { NextResponse } from 'next/server';
import { templateService } from '@/services/templateService';
import { ApiErrorResponse } from '@/types';

/**
 * GET /api/templates
 * Lista todas las plantillas, opcionalmente filtradas por tipo (word | xlsx).
 * Query params: ?type=word | ?type=xlsx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'word' | 'xlsx' | null;

    const templates = await templateService.listTemplates(type || undefined);

    return NextResponse.json({ templates });
  } catch {
    const errorResponse: ApiErrorResponse = {
      error: {
        code: 'STORAGE_FAILED',
        message: 'Error al obtener las plantillas. Intente nuevamente',
        retryable: true,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
