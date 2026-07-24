import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { shouldCompress, compressImage } from '@/utils/imageCompression';

/**
 * Feature: v2-scanner-optimization, Property 1: Compression reduces size while maintaining DPI
 * **Validates: Requirements 1.1**
 *
 * Para cualquier imagen mayor a 2MB, al aplicar compressImage:
 * - compressedSize < originalSize
 * - El DPI efectivo de la salida es >= 150 (outputWidth >= originalWidth * (minDPI / 300))
 */

// --- Helpers para mocks de Canvas y ImageBitmap ---

/**
 * Crea un File mock con tamaño específico.
 * Genera un ArrayBuffer del tamaño exacto para simular el archivo.
 */
function createMockFile(sizeBytes: number, width: number, height: number): File {
  // Crear un buffer mínimo (no necesitamos sizeBytes reales en memoria para el mock)
  const buffer = new ArrayBuffer(Math.min(sizeBytes, 1024));
  const blob = new Blob([buffer], { type: 'image/jpeg' });

  // Override size property para simular el tamaño deseado
  const file = new File([blob], 'test-image.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: sizeBytes, writable: false });

  // Almacenar dimensiones en el file para que el mock de createImageBitmap las lea
  (file as any).__mockWidth = width;
  (file as any).__mockHeight = height;

  return file;
}

/**
 * Calcula un tamaño de blob simulado proporcional a las dimensiones y calidad.
 * Simula el comportamiento real: más píxeles y más calidad = archivo más grande.
 * El factor base convierte dimensiones*calidad en bytes de forma realista.
 */
function simulatedBlobSize(width: number, height: number, quality: number): number {
  // Factor empírico: ~0.5 bytes por píxel a calidad 1.0 para JPEG
  const bytesPerPixelAtMaxQuality = 0.5;
  return Math.round(width * height * quality * bytesPerPixelAtMaxQuality);
}

// --- Setup de mocks ---

let originalCreateElement: typeof document.createElement;
let createImageBitmapSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalCreateElement = document.createElement.bind(document);

  // Mock de createImageBitmap global
  createImageBitmapSpy = vi.fn().mockImplementation((file: File) => {
    const width = (file as any).__mockWidth || 1000;
    const height = (file as any).__mockHeight || 1000;
    return Promise.resolve({
      width,
      height,
      close: vi.fn(),
    } as unknown as ImageBitmap);
  });
  vi.stubGlobal('createImageBitmap', createImageBitmapSpy);

  // Mock de document.createElement para interceptar canvas
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn().mockImplementation(function (
          this: any,
          callback: (blob: Blob | null) => void,
          _mimeType?: string,
          quality?: number
        ) {
          // Usar las dimensiones asignadas al canvas y la calidad para calcular tamaño
          const blobSize = simulatedBlobSize(
            canvas.width,
            canvas.height,
            quality ?? 0.85
          );
          const mockBlob = new Blob([new ArrayBuffer(Math.min(blobSize, 1024))], {
            type: 'image/jpeg',
          });
          Object.defineProperty(mockBlob, 'size', { value: blobSize, writable: false });
          callback(mockBlob);
        }),
      };
      return canvas as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// --- Generadores (Arbitraries) ---

/**
 * Genera tamaños de archivo mayores a 2MB (el umbral de compresión).
 * Rango: 2MB+1 byte hasta 20MB
 */
const largeFileSizeArb = fc.integer({
  min: 2 * 1024 * 1024 + 1,
  max: 20 * 1024 * 1024,
});

/**
 * Genera tamaños de archivo menores o iguales a 2MB.
 */
const smallFileSizeArb = fc.integer({
  min: 1024,
  max: 2 * 1024 * 1024,
});

/**
 * Genera dimensiones de imagen que sean lo suficientemente grandes
 * para que el archivo simulado > 2MB sea coherente con los píxeles.
 * Mínimo 500px para representar documentos reales.
 */
const imageDimensionsArb = fc.record({
  width: fc.integer({ min: 500, max: 6000 }),
  height: fc.integer({ min: 500, max: 6000 }),
});

/**
 * Genera opciones de compresión parciales.
 */
const compressionOptionsArb = fc.record({
  maxWidth: fc.integer({ min: 1024, max: 4096 }),
  maxHeight: fc.integer({ min: 1024, max: 4096 }),
  quality: fc.double({ min: 0.5, max: 1.0, noNaN: true }),
  minDPI: fc.constant(150),
  maxFileSizeMB: fc.double({ min: 0.5, max: 5, noNaN: true }),
});

// --- Property Tests ---

describe('Feature: v2-scanner-optimization, Property 1: Compression reduces size while maintaining DPI', () => {
  it('shouldCompress returns true for files > 2MB', () => {
    fc.assert(
      fc.property(largeFileSizeArb, (fileSize) => {
        const file = createMockFile(fileSize, 1000, 1000);
        expect(shouldCompress(file)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('shouldCompress returns false for files <= 2MB', () => {
    fc.assert(
      fc.property(smallFileSizeArb, (fileSize) => {
        const file = createMockFile(fileSize, 1000, 1000);
        expect(shouldCompress(file)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('compressImage produces compressedSize < originalSize for files > 2MB', async () => {
    await fc.assert(
      fc.asyncProperty(
        largeFileSizeArb,
        imageDimensionsArb,
        async (fileSize, dims) => {
          const file = createMockFile(fileSize, dims.width, dims.height);
          const result = await compressImage(file);

          // La compresión debe reducir el tamaño
          expect(result.compressedSize).toBeLessThan(result.originalSize);
          expect(result.originalSize).toBe(fileSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compressImage output dimensions respect minimum DPI constraint (iterative loop never reduces below minScale)', async () => {
    await fc.assert(
      fc.asyncProperty(
        largeFileSizeArb,
        imageDimensionsArb,
        async (fileSize, dims) => {
          const file = createMockFile(fileSize, dims.width, dims.height);
          const result = await compressImage(file);

          // minDPI = 150, assumedOriginalDPI = 300, minScale = 0.5
          // La restricción de DPI aplica al loop iterativo: nunca reduce por debajo de
          // originalWidth * minScale. Sin embargo, calculateDimensions puede reducir
          // el ancho inicial para respetar maxWidth/maxHeight (mantiene aspect ratio).
          //
          // El ancho inicial tras calculateDimensions es el punto de partida del loop.
          // El loop garantiza: result.width / originalWidth >= minScale
          // O bien, result.width >= ancho inicial (si ya estaba por debajo de minScale).
          const minScale = 0.5;
          const minFromDPI = Math.floor(dims.width * minScale);

          // Calcular el ancho que calculateDimensions produciría
          let initialWidth = dims.width;
          let initialHeight = dims.height;
          const maxWidth = 2048;
          const maxHeight = 2048;

          if (initialWidth > maxWidth || initialHeight > maxHeight) {
            const aspectRatio = initialWidth / initialHeight;
            if (initialWidth > maxWidth) {
              initialWidth = maxWidth;
              initialHeight = Math.round(initialWidth / aspectRatio);
            }
            if (initialHeight > maxHeight) {
              initialHeight = maxHeight;
              initialWidth = Math.round(initialHeight * aspectRatio);
            }
          }

          // El resultado nunca será menor que el máximo entre:
          // - El ancho restringido por minScale en el loop iterativo
          // - El ancho inicial si calculateDimensions ya lo redujo por debajo de minScale
          // En la práctica: si initialWidth < minFromDPI, el loop no reduce más.
          // Si initialWidth >= minFromDPI, el loop no baja de minFromDPI.
          const effectiveMin = Math.min(initialWidth, minFromDPI);

          expect(result.width).toBeGreaterThanOrEqual(effectiveMin);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('compressImage with custom options respects minDPI constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        largeFileSizeArb,
        imageDimensionsArb,
        compressionOptionsArb,
        async (fileSize, dims, opts) => {
          const file = createMockFile(fileSize, dims.width, dims.height);
          const result = await compressImage(file, opts);

          // minScale = minDPI / 300 = 150 / 300 = 0.5
          const minScale = opts.minDPI / 300;

          // Calcular el ancho que calculateDimensions produciría con las opciones custom
          let initialWidth = dims.width;
          let initialHeight = dims.height;

          if (initialWidth > opts.maxWidth || initialHeight > opts.maxHeight) {
            const aspectRatio = initialWidth / initialHeight;
            if (initialWidth > opts.maxWidth) {
              initialWidth = opts.maxWidth;
              initialHeight = Math.round(initialWidth / aspectRatio);
            }
            if (initialHeight > opts.maxHeight) {
              initialHeight = opts.maxHeight;
              initialWidth = Math.round(initialHeight * aspectRatio);
            }
          }

          // El mínimo permitido por DPI respecto al original
          const minFromDPI = Math.floor(dims.width * minScale);

          // El resultado respeta: no reduce iterativamente por debajo del minScale
          const effectiveMin = Math.min(initialWidth, minFromDPI);
          expect(result.width).toBeGreaterThanOrEqual(effectiveMin);
        }
      ),
      { numRuns: 100 }
    );
  });
});
