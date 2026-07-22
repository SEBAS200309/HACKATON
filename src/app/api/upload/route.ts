import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { templateService } from '@/services/templateService';
import { storageService } from '@/services/storageService';
import { ApiErrorResponse } from '@/types';

const MAX_FILE_SIZE = 26_214_400; // 25MB en bytes

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  word: ['.docx'],
  xlsx: ['.xlsx'],
  source: ['.pdf', '.png', '.jpg', '.jpeg'],
};

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

function buildFormatErrorMessage(type: string): string {
  const formats = ALLOWED_EXTENSIONS[type];
  if (!formats) return 'Formato no soportado';
  const formatsStr = formats.map((f) => f.replace('.', '.')).join(', ');
  return `Formato no soportado. Solo se permiten archivos ${formatsStr}`;
}

function createErrorResponse(code: string, message: string, status: number, retryable: boolean = false): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message, retryable } },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const fileName = (formData.get('fileName') as string) || file?.name || '';

    // Validar campos requeridos
    if (!file || !type) {
      return createErrorResponse(
        'FILE_FORMAT_INVALID',
        'Faltan campos requeridos: file y type son obligatorios',
        400
      );
    }

    // Validar tipo válido
    if (!['word', 'xlsx', 'source'].includes(type)) {
      return createErrorResponse(
        'FILE_FORMAT_INVALID',
        'Tipo no válido. Debe ser: word, xlsx o source',
        400
      );
    }

    // Validar extensión de archivo
    const extension = getFileExtension(fileName);
    const allowedExtensions = ALLOWED_EXTENSIONS[type];

    if (!extension || !allowedExtensions.includes(extension)) {
      return createErrorResponse(
        'FILE_FORMAT_INVALID',
        buildFormatErrorMessage(type),
        400
      );
    }

    // Validar tamaño de archivo
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        'FILE_TOO_LARGE',
        'El archivo excede el tamaño máximo permitido de 25MB',
        400
      );
    }

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Procesar según el tipo
    if (type === 'word' || type === 'xlsx') {
      // Usar templateService que valida estructura, almacena en S3, extrae placeholders/headers y actualiza el índice
      try {
        const metadata = await templateService.uploadTemplate(buffer, fileName, type);
        return NextResponse.json(metadata, { status: 201 });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Detectar errores de estructura corrupta
        if (errorMessage.includes('dañado') || errorMessage.includes('no es un documento')) {
          return createErrorResponse(
            'FILE_CORRUPT',
            'El archivo está dañado o no es un documento válido',
            400
          );
        }

        // Error genérico de almacenamiento
        return createErrorResponse(
          'UPLOAD_FAILED',
          'Error al cargar el archivo. Verifique su conexión e intente nuevamente',
          503,
          true
        );
      }
    } else {
      // Tipo 'source': generar UUID, almacenar en sources/ y actualizar índice
      try {
        const documentId = uuidv4();
        const s3Key = `sources/${documentId}${extension}`;
        const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

        await storageService.putObject(s3Key, buffer, contentType);

        // Actualizar sources/index.json
        const currentIndex = await storageService.getJsonIndex('sources') as Record<string, unknown>[];
        const sourceEntry = {
          id: documentId,
          fileName,
          s3Key,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
        };
        currentIndex.push(sourceEntry);
        await storageService.updateJsonIndex('sources', currentIndex);

        return NextResponse.json(sourceEntry, { status: 201 });
      } catch {
        return createErrorResponse(
          'UPLOAD_FAILED',
          'Error al cargar el archivo. Verifique su conexión e intente nuevamente',
          503,
          true
        );
      }
    }
  } catch {
    return createErrorResponse(
      'UPLOAD_FAILED',
      'Error al cargar el archivo. Verifique su conexión e intente nuevamente',
      503,
      true
    );
  }
}
