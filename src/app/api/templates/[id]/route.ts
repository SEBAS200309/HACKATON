import { NextResponse } from 'next/server';
import { templateService } from '@/services/templateService';
import { ApiErrorResponse } from '@/types';

/**
 * DELETE /api/templates/[id]
 * Elimina una plantilla por su ID.
 * Remueve el archivo de S3 y actualiza el índice.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await templateService.deleteTemplate(params.id);

    return NextResponse.json({
      success: true,
      message: 'Plantilla eliminada exitosamente',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'La plantilla no fue encontrada') {
      const notFoundResponse: ApiErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: 'La plantilla no fue encontrada',
          retryable: false,
        },
      };

      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    const errorResponse: ApiErrorResponse = {
      error: {
        code: 'STORAGE_FAILED',
        message: 'Error al eliminar la plantilla. Intente nuevamente',
        retryable: true,
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
