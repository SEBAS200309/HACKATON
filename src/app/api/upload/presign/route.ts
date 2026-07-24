import { NextResponse } from 'next/server';
import { storageService } from '@/services/storageService';

/**
 * GET /api/upload/presign?key=sources/xxx.jpg
 * Returns a presigned download URL for a stored file.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'El parámetro key es obligatorio', retryable: false } },
        { status: 400 }
      );
    }

    // Only allow access to sources/ prefix for security
    if (!key.startsWith('sources/')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Acceso no permitido a esta clave', retryable: false } },
        { status: 403 }
      );
    }

    const url = await storageService.getPresignedDownloadUrl(key, 3600);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: { code: 'PRESIGN_FAILED', message: 'Error al generar URL de descarga', retryable: true } },
      { status: 500 }
    );
  }
}
