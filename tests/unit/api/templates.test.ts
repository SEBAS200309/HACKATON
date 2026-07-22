import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del templateService
vi.mock('@/services/templateService', () => ({
  templateService: {
    listTemplates: vi.fn(),
    deleteTemplate: vi.fn(),
  },
}));

import { templateService } from '@/services/templateService';
import { GET } from '@/app/api/templates/route';
import { DELETE } from '@/app/api/templates/[id]/route';

const mockListTemplates = vi.mocked(templateService.listTemplates);
const mockDeleteTemplate = vi.mocked(templateService.deleteTemplate);

describe('GET /api/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna todas las plantillas sin filtro de tipo', async () => {
    const plantillas = [
      {
        id: 'abc-123',
        type: 'word',
        fileName: 'contrato.docx',
        s3Key: 'templates/word/abc-123.docx',
        fileSize: 1024,
        placeholders: ['nombre', 'fecha'],
        uploadDate: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'def-456',
        type: 'xlsx',
        fileName: 'reporte.xlsx',
        s3Key: 'templates/xlsx/def-456.xlsx',
        fileSize: 2048,
        placeholders: ['columna1', 'columna2'],
        uploadDate: '2024-01-02T00:00:00.000Z',
      },
    ];

    mockListTemplates.mockResolvedValue(plantillas as any);

    const request = new Request('http://localhost:3000/api/templates');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('abc-123');
    expect(data[1].id).toBe('def-456');
    expect(mockListTemplates).toHaveBeenCalledWith(undefined);
  });

  it('filtra plantillas por tipo word', async () => {
    const plantillasWord = [
      {
        id: 'abc-123',
        type: 'word',
        fileName: 'contrato.docx',
        s3Key: 'templates/word/abc-123.docx',
        fileSize: 1024,
        placeholders: ['nombre'],
        uploadDate: '2024-01-01T00:00:00.000Z',
      },
    ];

    mockListTemplates.mockResolvedValue(plantillasWord as any);

    const request = new Request('http://localhost:3000/api/templates?type=word');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(mockListTemplates).toHaveBeenCalledWith('word');
  });

  it('retorna error 500 cuando el servicio falla', async () => {
    mockListTemplates.mockRejectedValue(new Error('S3 connection error'));

    const request = new Request('http://localhost:3000/api/templates');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('STORAGE_FAILED');
    expect(data.error.message).toBe('Error al obtener las plantillas. Intente nuevamente');
    expect(data.error.retryable).toBe(true);
  });
});

describe('DELETE /api/templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elimina una plantilla exitosamente', async () => {
    mockDeleteTemplate.mockResolvedValue(undefined);

    const request = new Request('http://localhost:3000/api/templates/abc-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { id: 'abc-123' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Plantilla eliminada exitosamente');
    expect(mockDeleteTemplate).toHaveBeenCalledWith('abc-123');
  });

  it('retorna 404 cuando la plantilla no existe', async () => {
    mockDeleteTemplate.mockRejectedValue(new Error('La plantilla no fue encontrada'));

    const request = new Request('http://localhost:3000/api/templates/no-existe', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { id: 'no-existe' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(data.error.message).toBe('La plantilla no fue encontrada');
    expect(data.error.retryable).toBe(false);
  });

  it('retorna 500 cuando ocurre un error inesperado', async () => {
    mockDeleteTemplate.mockRejectedValue(new Error('Error de conexión S3'));

    const request = new Request('http://localhost:3000/api/templates/abc-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: { id: 'abc-123' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('STORAGE_FAILED');
    expect(data.error.message).toBe('Error al eliminar la plantilla. Intente nuevamente');
    expect(data.error.retryable).toBe(true);
  });
});
