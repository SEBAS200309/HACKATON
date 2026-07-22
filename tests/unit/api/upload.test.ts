// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock de los servicios antes de importar la ruta
vi.mock('@/services/templateService', () => ({
  templateService: {
    uploadTemplate: vi.fn(),
  },
}));

vi.mock('@/services/storageService', () => ({
  storageService: {
    putObject: vi.fn(),
    getJsonIndex: vi.fn().mockResolvedValue([]),
    updateJsonIndex: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

import { POST } from '@/app/api/upload/route';
import { templateService } from '@/services/templateService';
import { storageService } from '@/services/storageService';

function createMockFormData(fields: Record<string, string | File>): Request {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData,
  });
}

function createMockFile(name: string, size: number, type: string = 'application/octet-stream'): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Validación de campos requeridos', () => {
    it('debe retornar 400 cuando falta el archivo', async () => {
      const formData = new FormData();
      formData.append('type', 'word');
      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
    });

    it('debe retornar 400 cuando falta el tipo', async () => {
      const file = createMockFile('documento.docx', 100);
      const formData = new FormData();
      formData.append('file', file);
      const request = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
    });

    it('debe retornar 400 cuando el tipo no es válido', async () => {
      const file = createMockFile('documento.docx', 100);
      const request = createMockFormData({
        file,
        type: 'invalid',
        fileName: 'documento.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
    });
  });

  describe('Validación de extensión de archivo (FILE_FORMAT_INVALID)', () => {
    it('debe rechazar .xlsx cuando el tipo es word', async () => {
      const file = createMockFile('archivo.xlsx', 100);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'archivo.xlsx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
      expect(data.error.message).toContain('.docx');
    });

    it('debe rechazar .docx cuando el tipo es xlsx', async () => {
      const file = createMockFile('archivo.docx', 100);
      const request = createMockFormData({
        file,
        type: 'xlsx',
        fileName: 'archivo.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
      expect(data.error.message).toContain('.xlsx');
    });

    it('debe rechazar .docx cuando el tipo es source', async () => {
      const file = createMockFile('archivo.docx', 100);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'archivo.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
      expect(data.error.message).toContain('.pdf');
    });

    it('debe rechazar archivos sin extensión', async () => {
      const file = createMockFile('archivo', 100);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'archivo',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_FORMAT_INVALID');
    });
  });

  describe('Validación de tamaño (FILE_TOO_LARGE)', () => {
    it('debe rechazar archivos mayores a 25MB', async () => {
      const file = createMockFile('grande.docx', 26_214_401);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'grande.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_TOO_LARGE');
      expect(data.error.message).toBe('El archivo excede el tamaño máximo permitido de 25MB');
    });

    it('debe aceptar archivos de exactamente 25MB', async () => {
      const file = createMockFile('exacto.docx', 26_214_400);
      vi.mocked(templateService.uploadTemplate).mockResolvedValue({
        id: 'test-id',
        type: 'word',
        fileName: 'exacto.docx',
        s3Key: 'templates/word/test-id.docx',
        fileSize: 26_214_400,
        placeholders: [],
        uploadDate: '2024-01-01T00:00:00.000Z',
      });

      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'exacto.docx',
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Upload de templates (word/xlsx)', () => {
    it('debe subir un archivo .docx correctamente y retornar metadata', async () => {
      const mockMetadata = {
        id: 'test-id',
        type: 'word' as const,
        fileName: 'plantilla.docx',
        s3Key: 'templates/word/test-id.docx',
        fileSize: 1024,
        placeholders: ['nombre', 'fecha'],
        uploadDate: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(templateService.uploadTemplate).mockResolvedValue(mockMetadata);

      const file = createMockFile('plantilla.docx', 1024);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'plantilla.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('test-id');
      expect(data.type).toBe('word');
      expect(data.placeholders).toEqual(['nombre', 'fecha']);
      expect(templateService.uploadTemplate).toHaveBeenCalledWith(
        expect.any(Buffer),
        'plantilla.docx',
        'word'
      );
    });

    it('debe subir un archivo .xlsx correctamente', async () => {
      const mockMetadata = {
        id: 'test-id',
        type: 'xlsx' as const,
        fileName: 'datos.xlsx',
        s3Key: 'templates/xlsx/test-id.xlsx',
        fileSize: 2048,
        placeholders: ['columna1', 'columna2'],
        uploadDate: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(templateService.uploadTemplate).mockResolvedValue(mockMetadata);

      const file = createMockFile('datos.xlsx', 2048);
      const request = createMockFormData({
        file,
        type: 'xlsx',
        fileName: 'datos.xlsx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.type).toBe('xlsx');
      expect(templateService.uploadTemplate).toHaveBeenCalledWith(
        expect.any(Buffer),
        'datos.xlsx',
        'xlsx'
      );
    });

    it('debe retornar FILE_CORRUPT cuando templateService lanza error de estructura', async () => {
      vi.mocked(templateService.uploadTemplate).mockRejectedValue(
        new Error('El archivo está dañado o no es un documento Word válido')
      );

      const file = createMockFile('corrupto.docx', 100);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'corrupto.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('FILE_CORRUPT');
      expect(data.error.message).toBe('El archivo está dañado o no es un documento válido');
    });

    it('debe retornar UPLOAD_FAILED cuando hay error de almacenamiento', async () => {
      vi.mocked(templateService.uploadTemplate).mockRejectedValue(
        new Error('Error de conexión S3')
      );

      const file = createMockFile('plantilla.docx', 100);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'plantilla.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error.code).toBe('UPLOAD_FAILED');
      expect(data.error.retryable).toBe(true);
    });
  });

  describe('Upload de documentos fuente (source)', () => {
    it('debe subir un archivo .pdf correctamente', async () => {
      vi.mocked(storageService.getJsonIndex).mockResolvedValue([]);
      vi.mocked(storageService.putObject).mockResolvedValue(undefined);
      vi.mocked(storageService.updateJsonIndex).mockResolvedValue(undefined);

      const file = createMockFile('documento.pdf', 5000);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'documento.pdf',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('test-uuid-1234');
      expect(data.fileName).toBe('documento.pdf');
      expect(data.s3Key).toBe('sources/test-uuid-1234.pdf');
      expect(data.fileSize).toBe(5000);
      expect(data.uploadDate).toBeDefined();
    });

    it('debe subir un archivo .png correctamente', async () => {
      vi.mocked(storageService.getJsonIndex).mockResolvedValue([]);
      vi.mocked(storageService.putObject).mockResolvedValue(undefined);
      vi.mocked(storageService.updateJsonIndex).mockResolvedValue(undefined);

      const file = createMockFile('scan.png', 3000);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'scan.png',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.s3Key).toBe('sources/test-uuid-1234.png');
      expect(storageService.putObject).toHaveBeenCalledWith(
        'sources/test-uuid-1234.png',
        expect.any(Buffer),
        'image/png'
      );
    });

    it('debe subir un archivo .jpg correctamente', async () => {
      vi.mocked(storageService.getJsonIndex).mockResolvedValue([]);
      vi.mocked(storageService.putObject).mockResolvedValue(undefined);
      vi.mocked(storageService.updateJsonIndex).mockResolvedValue(undefined);

      const file = createMockFile('foto.jpg', 2000);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'foto.jpg',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.s3Key).toBe('sources/test-uuid-1234.jpg');
      expect(storageService.putObject).toHaveBeenCalledWith(
        'sources/test-uuid-1234.jpg',
        expect.any(Buffer),
        'image/jpeg'
      );
    });

    it('debe actualizar sources/index.json al subir un source', async () => {
      const existingEntries = [{ id: 'existing-1', fileName: 'otro.pdf' }];
      vi.mocked(storageService.getJsonIndex).mockResolvedValue(existingEntries);
      vi.mocked(storageService.putObject).mockResolvedValue(undefined);
      vi.mocked(storageService.updateJsonIndex).mockResolvedValue(undefined);

      const file = createMockFile('nuevo.pdf', 4000);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'nuevo.pdf',
      });

      await POST(request);

      expect(storageService.updateJsonIndex).toHaveBeenCalledWith(
        'sources',
        expect.arrayContaining([
          expect.objectContaining({ id: 'existing-1' }),
          expect.objectContaining({ id: 'test-uuid-1234', fileName: 'nuevo.pdf' }),
        ])
      );
    });

    it('debe retornar UPLOAD_FAILED cuando falla S3 en source', async () => {
      vi.mocked(storageService.putObject).mockRejectedValue(new Error('S3 error'));

      const file = createMockFile('documento.pdf', 1000);
      const request = createMockFormData({
        file,
        type: 'source',
        fileName: 'documento.pdf',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error.code).toBe('UPLOAD_FAILED');
      expect(data.error.retryable).toBe(true);
    });
  });

  describe('Uso de fileName del FormData', () => {
    it('debe usar fileName del FormData cuando se proporciona', async () => {
      vi.mocked(templateService.uploadTemplate).mockResolvedValue({
        id: 'test-id',
        type: 'word',
        fileName: 'nombre-personalizado.docx',
        s3Key: 'templates/word/test-id.docx',
        fileSize: 100,
        placeholders: [],
        uploadDate: '2024-01-01T00:00:00.000Z',
      });

      const file = createMockFile('original.docx', 100);
      const request = createMockFormData({
        file,
        type: 'word',
        fileName: 'nombre-personalizado.docx',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fileName).toBe('nombre-personalizado.docx');
    });
  });
});
