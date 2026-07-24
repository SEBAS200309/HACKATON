import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldCompress, compressImage } from './imageCompression';

describe('imageCompression', () => {
  describe('shouldCompress', () => {
    it('retorna true para archivos mayores a 2MB', () => {
      const file = new File(['x'.repeat(3 * 1024 * 1024)], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(shouldCompress(file)).toBe(true);
    });

    it('retorna false para archivos de exactamente 2MB', () => {
      const file = new File(['x'.repeat(2 * 1024 * 1024)], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(shouldCompress(file)).toBe(false);
    });

    it('retorna false para archivos menores a 2MB', () => {
      const file = new File(['x'.repeat(1 * 1024 * 1024)], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(shouldCompress(file)).toBe(false);
    });

    it('retorna false para archivo vacío', () => {
      const file = new File([], 'test.jpg', { type: 'image/jpeg' });
      expect(shouldCompress(file)).toBe(false);
    });

    it('retorna true para archivo justo encima de 2MB', () => {
      const file = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'test.jpg', {
        type: 'image/jpeg',
      });
      expect(shouldCompress(file)).toBe(true);
    });
  });

  describe('compressImage', () => {
    let mockCanvas: {
      width: number;
      height: number;
      getContext: ReturnType<typeof vi.fn>;
      toBlob: ReturnType<typeof vi.fn>;
    };
    let mockCtx: { drawImage: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockCtx = { drawImage: vi.fn() };
      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return document.createElement(tag);
      });
    });

    it('retorna CompressionResult con propiedades correctas', async () => {
      // Simular un blob de salida de 1MB (menor que maxFileSizeMB)
      const outputBlob = new Blob(['x'.repeat(1024 * 1024)], {
        type: 'image/jpeg',
      });

      mockCanvas.toBlob.mockImplementation(
        (callback: BlobCallback) => {
          callback(outputBlob);
        }
      );

      // Simular createImageBitmap
      const mockBitmap = { width: 3000, height: 2000, close: vi.fn() };
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap)
      );

      const inputFile = new File(['x'.repeat(3 * 1024 * 1024)], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const result = await compressImage(inputFile);

      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('compressedSize');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result.originalSize).toBe(inputFile.size);
      expect(result.compressedSize).toBe(outputBlob.size);
    });

    it('respeta maxWidth y maxHeight al redimensionar', async () => {
      const outputBlob = new Blob(['x'.repeat(500 * 1024)], {
        type: 'image/jpeg',
      });

      mockCanvas.toBlob.mockImplementation(
        (callback: BlobCallback) => {
          callback(outputBlob);
        }
      );

      const mockBitmap = { width: 4000, height: 3000, close: vi.fn() };
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap)
      );

      const inputFile = new File(['x'.repeat(3 * 1024 * 1024)], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const result = await compressImage(inputFile, {
        maxWidth: 1024,
        maxHeight: 1024,
      });

      // Dimensiones deben estar dentro de los límites
      expect(result.width).toBeLessThanOrEqual(1024);
      expect(result.height).toBeLessThanOrEqual(1024);
    });

    it('reduce calidad iterativamente si el blob excede maxFileSizeMB', async () => {
      let callCount = 0;

      mockCanvas.toBlob.mockImplementation(
        (callback: BlobCallback) => {
          callCount++;
          // Primeras llamadas generan blob grande, luego uno pequeño
          if (callCount < 4) {
            callback(
              new Blob(['x'.repeat(3 * 1024 * 1024)], { type: 'image/jpeg' })
            );
          } else {
            callback(
              new Blob(['x'.repeat(1 * 1024 * 1024)], { type: 'image/jpeg' })
            );
          }
        }
      );

      const mockBitmap = { width: 2000, height: 1500, close: vi.fn() };
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap)
      );

      const inputFile = new File(['x'.repeat(4 * 1024 * 1024)], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const result = await compressImage(inputFile);

      // Debió iterar varias veces antes de lograr el tamaño objetivo
      expect(callCount).toBeGreaterThan(1);
      expect(result.compressedSize).toBeLessThanOrEqual(2 * 1024 * 1024);
    });

    it('no reduce dimensiones por debajo del mínimo DPI', async () => {
      // Siempre genera blob grande para forzar reducción de dimensiones
      let lastWidth = 0;

      mockCanvas.toBlob.mockImplementation(
        (callback: BlobCallback) => {
          lastWidth = mockCanvas.width;
          // Siempre retornar blob grande para forzar iteración completa
          callback(
            new Blob(['x'.repeat(3 * 1024 * 1024)], { type: 'image/jpeg' })
          );
        }
      );

      const originalWidth = 2000;
      const mockBitmap = {
        width: originalWidth,
        height: 1500,
        close: vi.fn(),
      };
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue(mockBitmap)
      );

      const inputFile = new File(['x'.repeat(5 * 1024 * 1024)], 'photo.jpg', {
        type: 'image/jpeg',
      });

      await compressImage(inputFile);

      // El ancho final no debe ser menor que originalWidth * (150/300) = 50%
      const minAllowedWidth = originalWidth * (150 / 300);
      expect(lastWidth).toBeGreaterThanOrEqual(minAllowedWidth);
    });
  });
});
