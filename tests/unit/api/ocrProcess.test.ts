// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock del ocrService antes de importar la ruta
vi.mock('@/services/ocrService', () => ({
  ocrService: {
    processDocument: vi.fn(),
  },
}));

import { POST } from '@/app/api/ocr/process/route';
import { ocrService } from '@/services/ocrService';

function createOcrRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/ocr/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ocr/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Validación de campos requeridos', () => {
    it('debe retornar 400 cuando falta documentKey', async () => {
      const request = createOcrRequest({
        areas: [{ id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'nombre', color: '#ff0000' }],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('OCR_FAILED');
      expect(data.error.message).toContain('documentKey');
    });

    it('debe retornar 400 cuando falta areas', async () => {
      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('OCR_FAILED');
      expect(data.error.message).toContain('areas');
    });

    it('debe retornar 400 cuando areas es un array vacío', async () => {
      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('OCR_FAILED');
      expect(data.error.message).toContain('array no vacío');
    });

    it('debe retornar 400 cuando areas no es un array', async () => {
      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas: 'not-an-array',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('OCR_FAILED');
    });
  });

  describe('Procesamiento exitoso', () => {
    it('debe retornar resultados OCR cuando el procesamiento es exitoso', async () => {
      const mockResults = [
        { variableName: 'nombre', extractedText: 'Juan Pérez', confidence: 95.5, wordCount: 2 },
        { variableName: 'fecha', extractedText: '2024-01-15', confidence: 98.0, wordCount: 1 },
      ];
      vi.mocked(ocrService.processDocument).mockResolvedValue(mockResults);

      const areas = [
        { id: '1', x: 0.1, y: 0.1, width: 0.4, height: 0.1, variableName: 'nombre', color: '#ff0000' },
        { id: '2', x: 0.1, y: 0.3, width: 0.3, height: 0.1, variableName: 'fecha', color: '#00ff00' },
      ];
      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResults);
      expect(ocrService.processDocument).toHaveBeenCalledWith('sources/doc-123.pdf', areas);
    });

    it('debe pasar correctamente documentKey y areas al servicio', async () => {
      vi.mocked(ocrService.processDocument).mockResolvedValue([]);

      const areas = [
        { id: 'area-1', x: 0, y: 0, width: 1, height: 1, variableName: 'contenido', color: '#0000ff' },
      ];
      const request = createOcrRequest({
        documentKey: 'sources/mi-documento.png',
        areas,
      });

      await POST(request);

      expect(ocrService.processDocument).toHaveBeenCalledWith('sources/mi-documento.png', areas);
    });
  });

  describe('Manejo de timeout (OCR_TIMEOUT)', () => {
    it('debe retornar 504 cuando el procesamiento excede 60 segundos', async () => {
      vi.useRealTimers();

      // Simular un procesamiento que se rechaza con OCR_TIMEOUT (simulando el comportamiento del timeout)
      vi.mocked(ocrService.processDocument).mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OCR_TIMEOUT')), 10);
        })
      );

      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas: [{ id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'test', color: '#ff0000' }],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(504);
      expect(data.error.code).toBe('OCR_TIMEOUT');
      expect(data.error.message).toBe('El procesamiento OCR tardó demasiado. Intente nuevamente');
      expect(data.error.retryable).toBe(true);
    });
  });

  describe('Manejo de errores (OCR_FAILED)', () => {
    it('debe retornar 502 cuando ocrService lanza un error', async () => {
      vi.mocked(ocrService.processDocument).mockRejectedValue(
        new Error('Error en el procesamiento OCR: Textract falló')
      );

      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas: [{ id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'test', color: '#ff0000' }],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.code).toBe('OCR_FAILED');
      expect(data.error.message).toBe('Error en el procesamiento OCR. Verifique la calidad del documento e intente nuevamente');
      expect(data.error.retryable).toBe(true);
    });

    it('debe retornar 502 cuando se lanza un error no-Error', async () => {
      vi.mocked(ocrService.processDocument).mockRejectedValue('unknown error');

      const request = createOcrRequest({
        documentKey: 'sources/doc-123.pdf',
        areas: [{ id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'test', color: '#ff0000' }],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.code).toBe('OCR_FAILED');
      expect(data.error.retryable).toBe(true);
    });
  });
});
