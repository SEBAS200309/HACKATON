import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TextractBlock, AreaOfInterest } from '@/types';

// Mock storageService
const mockGetObject = vi.fn();

vi.mock('@/services/storageService', () => ({
  storageService: {
    getObject: (...args: any[]) => mockGetObject(...args),
  },
}));

// Mock AWS Textract client
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-textract', () => {
  return {
    TextractClient: class MockTextractClient {
      send(...args: any[]) {
        return mockSend(...args);
      }
    },
    DetectDocumentTextCommand: class MockCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

describe('OcrService', () => {
  let ocrService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetObject.mockResolvedValue(Buffer.from('fake-image-bytes'));
    mockSend.mockResolvedValue({ Blocks: [] });

    vi.resetModules();
    vi.doMock('@/services/storageService', () => ({
      storageService: {
        getObject: (...args: any[]) => mockGetObject(...args),
      },
    }));
    vi.doMock('@aws-sdk/client-textract', () => {
      return {
        TextractClient: class MockTextractClient {
          send(...args: any[]) {
            return mockSend(...args);
          }
        },
        DetectDocumentTextCommand: class MockCommand {
          input: any;
          constructor(input: any) {
            this.input = input;
          }
        },
      };
    });

    const module = await import('@/services/ocrService');
    ocrService = module.ocrService;
  });

  const crearArea = (overrides?: Partial<AreaOfInterest>): AreaOfInterest => ({
    id: 'area-1',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.15,
    variableName: 'nombre_completo',
    color: '#ff0000',
    ...overrides,
  });

  const crearBloque = (overrides?: Partial<TextractBlock>): TextractBlock => ({
    blockType: 'WORD',
    text: 'Hola',
    confidence: 95,
    boundingBox: { width: 0.05, height: 0.02, left: 0.15, top: 0.25 },
    ...overrides,
  });

  describe('filterBlocksByArea', () => {
    it('debe incluir bloques WORD que se superponen con el área', () => {
      const area = crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 });
      const block = crearBloque({
        boundingBox: { left: 0.15, top: 0.25, width: 0.05, height: 0.02 },
      });

      const resultado = ocrService.filterBlocksByArea([block], area);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].text).toBe('Hola');
    });

    it('debe excluir bloques WORD que NO se superponen con el área', () => {
      const area = crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 });
      // Bloque completamente fuera del área (a la derecha)
      const block = crearBloque({
        boundingBox: { left: 0.8, top: 0.25, width: 0.05, height: 0.02 },
      });

      const resultado = ocrService.filterBlocksByArea([block], area);

      expect(resultado).toHaveLength(0);
    });

    it('debe excluir bloques que NO son de tipo WORD', () => {
      const area = crearArea({ x: 0.0, y: 0.0, width: 1.0, height: 1.0 });
      const lineBlock = crearBloque({ blockType: 'LINE' });
      const pageBlock = crearBloque({ blockType: 'PAGE' });

      const resultado = ocrService.filterBlocksByArea([lineBlock, pageBlock], area);

      expect(resultado).toHaveLength(0);
    });

    it('debe incluir bloques parcialmente superpuestos con el área', () => {
      const area = crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 });
      // Bloque que empieza antes del área pero se extiende dentro
      const block = crearBloque({
        boundingBox: { left: 0.05, top: 0.25, width: 0.1, height: 0.02 },
      });

      const resultado = ocrService.filterBlocksByArea([block], area);

      expect(resultado).toHaveLength(1);
    });

    it('debe excluir bloques que están justo fuera del borde del área', () => {
      const area = crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 });
      // Bloque exactamente debajo del área (top >= area.y + area.height)
      const blockAbajo = crearBloque({
        boundingBox: { left: 0.15, top: 0.35, width: 0.05, height: 0.02 },
      });
      // Bloque exactamente a la izquierda del área (left + width <= area.x)
      const blockIzquierda = crearBloque({
        boundingBox: { left: 0.0, top: 0.25, width: 0.1, height: 0.02 },
      });

      const resultado = ocrService.filterBlocksByArea([blockAbajo, blockIzquierda], area);

      expect(resultado).toHaveLength(0);
    });

    it('debe manejar múltiples bloques, filtrando solo los que se superponen', () => {
      const area = crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15 });
      const blockDentro = crearBloque({
        text: 'dentro',
        boundingBox: { left: 0.15, top: 0.25, width: 0.05, height: 0.02 },
      });
      const blockFuera = crearBloque({
        text: 'fuera',
        boundingBox: { left: 0.9, top: 0.9, width: 0.05, height: 0.02 },
      });

      const resultado = ocrService.filterBlocksByArea([blockDentro, blockFuera], area);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].text).toBe('dentro');
    });
  });

  describe('calculateAreaConfidence', () => {
    it('debe retornar el mínimo de confianza de todos los bloques WORD', () => {
      const blocks: TextractBlock[] = [
        crearBloque({ confidence: 95 }),
        crearBloque({ confidence: 72 }),
        crearBloque({ confidence: 88 }),
      ];

      const resultado = ocrService.calculateAreaConfidence(blocks);

      expect(resultado).toBe(72);
    });

    it('debe retornar 0 si no hay bloques', () => {
      const resultado = ocrService.calculateAreaConfidence([]);

      expect(resultado).toBe(0);
    });

    it('debe retornar 0 si no hay bloques de tipo WORD', () => {
      const blocks: TextractBlock[] = [
        crearBloque({ blockType: 'LINE', confidence: 95 }),
        crearBloque({ blockType: 'PAGE', confidence: 88 }),
      ];

      const resultado = ocrService.calculateAreaConfidence(blocks);

      expect(resultado).toBe(0);
    });

    it('debe retornar la confianza única cuando hay un solo bloque WORD', () => {
      const blocks: TextractBlock[] = [crearBloque({ confidence: 45 })];

      const resultado = ocrService.calculateAreaConfidence(blocks);

      expect(resultado).toBe(45);
    });
  });

  describe('detectText', () => {
    it('debe enviar imagen a Textract y retornar bloques mapeados', async () => {
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'Juan',
            Confidence: 98.5,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.1, Top: 0.3 },
            },
          },
          {
            BlockType: 'LINE',
            Text: 'Juan Pérez',
            Confidence: 97.0,
            Geometry: {
              BoundingBox: { Width: 0.15, Height: 0.025, Left: 0.1, Top: 0.3 },
            },
          },
        ],
      });

      const resultado = await ocrService.detectText(Buffer.from('imagen'));

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toEqual({
        blockType: 'WORD',
        text: 'Juan',
        confidence: 98.5,
        boundingBox: { width: 0.05, height: 0.02, left: 0.1, top: 0.3 },
      });
      expect(resultado[1]).toEqual({
        blockType: 'LINE',
        text: 'Juan Pérez',
        confidence: 97.0,
        boundingBox: { width: 0.15, height: 0.025, left: 0.1, top: 0.3 },
      });
    });

    it('debe retornar array vacío cuando Textract no devuelve bloques', async () => {
      mockSend.mockResolvedValue({ Blocks: undefined });

      const resultado = await ocrService.detectText(Buffer.from('imagen'));

      expect(resultado).toEqual([]);
    });

    it('debe filtrar bloques sin BoundingBox', async () => {
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'válido',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.1, Top: 0.3 },
            },
          },
          {
            BlockType: 'WORD',
            Text: 'sin-geometría',
            Confidence: 85,
            Geometry: null,
          },
        ],
      });

      const resultado = await ocrService.detectText(Buffer.from('imagen'));

      expect(resultado).toHaveLength(1);
      expect(resultado[0].text).toBe('válido');
    });

    it('debe lanzar error con mensaje en español cuando Textract falla', async () => {
      mockSend.mockRejectedValue(new Error('ThrottlingException'));

      await expect(ocrService.detectText(Buffer.from('imagen'))).rejects.toThrow(
        'Error en el procesamiento OCR: ThrottlingException'
      );
    });
  });

  describe('processDocument', () => {
    it('debe obtener el documento de S3, llamar Textract, y retornar resultados por área', async () => {
      mockGetObject.mockResolvedValue(Buffer.from('imagen-bytes'));
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'Juan',
            Confidence: 98,
            Geometry: {
              BoundingBox: { Width: 0.04, Height: 0.02, Left: 0.15, Top: 0.25 },
            },
          },
          {
            BlockType: 'WORD',
            Text: 'Pérez',
            Confidence: 95,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.20, Top: 0.25 },
            },
          },
        ],
      });

      const areas: AreaOfInterest[] = [
        crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15, variableName: 'nombre' }),
      ];

      const resultado = await ocrService.processDocument('sources/doc.png', areas);

      expect(mockGetObject).toHaveBeenCalledWith('sources/doc.png');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].variableName).toBe('nombre');
      expect(resultado[0].extractedText).toBe('Juan Pérez');
      expect(resultado[0].confidence).toBe(95);
      expect(resultado[0].wordCount).toBe(2);
    });

    it('debe retornar texto vacío y confianza 0 cuando un área no tiene palabras', async () => {
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'texto',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.8, Top: 0.8 },
            },
          },
        ],
      });

      const areas: AreaOfInterest[] = [
        crearArea({ x: 0.0, y: 0.0, width: 0.1, height: 0.1, variableName: 'vacia' }),
      ];

      const resultado = await ocrService.processDocument('sources/doc.png', areas);

      expect(resultado[0].extractedText).toBe('');
      expect(resultado[0].confidence).toBe(0);
      expect(resultado[0].wordCount).toBe(0);
    });

    it('debe ordenar palabras en orden de lectura (top-to-bottom, left-to-right)', async () => {
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'segunda',
            Confidence: 90,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.20, Top: 0.25 },
            },
          },
          {
            BlockType: 'WORD',
            Text: 'primera',
            Confidence: 92,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.12, Top: 0.25 },
            },
          },
          {
            BlockType: 'WORD',
            Text: 'línea2',
            Confidence: 88,
            Geometry: {
              BoundingBox: { Width: 0.05, Height: 0.02, Left: 0.12, Top: 0.30 },
            },
          },
        ],
      });

      const areas: AreaOfInterest[] = [
        crearArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.15, variableName: 'texto' }),
      ];

      const resultado = await ocrService.processDocument('sources/doc.png', areas);

      expect(resultado[0].extractedText).toBe('primera segunda línea2');
    });

    it('debe procesar múltiples áreas independientemente', async () => {
      mockSend.mockResolvedValue({
        Blocks: [
          {
            BlockType: 'WORD',
            Text: 'Juan',
            Confidence: 98,
            Geometry: {
              BoundingBox: { Width: 0.04, Height: 0.02, Left: 0.15, Top: 0.12 },
            },
          },
          {
            BlockType: 'WORD',
            Text: '2024',
            Confidence: 85,
            Geometry: {
              BoundingBox: { Width: 0.04, Height: 0.02, Left: 0.55, Top: 0.62 },
            },
          },
        ],
      });

      const areas: AreaOfInterest[] = [
        crearArea({ id: 'a1', x: 0.1, y: 0.1, width: 0.3, height: 0.1, variableName: 'nombre' }),
        crearArea({ id: 'a2', x: 0.5, y: 0.6, width: 0.2, height: 0.1, variableName: 'fecha' }),
      ];

      const resultado = await ocrService.processDocument('sources/doc.png', areas);

      expect(resultado).toHaveLength(2);
      expect(resultado[0].variableName).toBe('nombre');
      expect(resultado[0].extractedText).toBe('Juan');
      expect(resultado[1].variableName).toBe('fecha');
      expect(resultado[1].extractedText).toBe('2024');
    });

    it('debe lanzar error con mensaje en español cuando S3 falla', async () => {
      mockGetObject.mockRejectedValue(new Error('El archivo no existe en S3'));

      await expect(
        ocrService.processDocument('sources/inexistente.png', [crearArea()])
      ).rejects.toThrow('Error en el procesamiento OCR del documento');
    });
  });
});
