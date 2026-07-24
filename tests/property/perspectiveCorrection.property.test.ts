import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { applyPerspectiveTransform } from '@/utils/perspectiveCorrection';
import type { Point } from '@/types';

/**
 * Feature: v2-scanner-optimization, Property 8: Perspective transform produces valid rectangle
 * **Validates: Requirements 3.3**
 *
 * Para cualquier 4 puntos esquina que definan un cuadrilátero convexo en una imagen fuente,
 * `applyPerspectiveTransform` produce un canvas de salida con las dimensiones
 * outputWidth x outputHeight sin lanzar errores.
 */

// --- Helpers para mocks de Canvas ---

/**
 * Crea un mock de canvas con dimensiones y contexto funcional.
 * Usa dimensiones pequeñas para el pixel data para mantener velocidad.
 */
function createMockSourceCanvas(width: number, height: number) {
  const pixelData = new Uint8ClampedArray(width * height * 4);
  // Llenar con datos arbitrarios para simular imagen
  for (let i = 0; i < pixelData.length; i++) {
    pixelData[i] = i % 256;
  }

  const mockImageData = {
    data: pixelData,
    width,
    height,
  };

  const mockCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(mockImageData),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
  };

  const canvas: any = {
    width,
    height,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn().mockReturnValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    ),
  };

  return canvas;
}

// --- Setup de mocks ---

let originalCreateElement: typeof document.createElement;

beforeEach(() => {
  originalCreateElement = document.createElement.bind(document);

  // Mock de document.createElement para interceptar canvas creados internamente
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      const outputCanvas: any = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          }),
          createImageData: vi.fn((w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h,
          })),
          putImageData: vi.fn(),
        }),
        toDataURL: vi.fn().mockReturnValue(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        ),
      };
      return outputCanvas as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Generadores (Arbitraries) ---

/**
 * Genera dimensiones de canvas fuente pequeñas para mantener velocidad del test.
 * La función hace un loop O(outputWidth * outputHeight) con operaciones por pixel.
 */
const sourceDimensionsArb = fc.record({
  width: fc.integer({ min: 20, max: 200 }),
  height: fc.integer({ min: 20, max: 200 }),
});

/**
 * Genera dimensiones de salida pequeñas para evitar timeouts.
 * El loop de perspectiva es O(outputWidth * outputHeight).
 */
const outputDimensionsArb = fc.record({
  outputWidth: fc.integer({ min: 10, max: 80 }),
  outputHeight: fc.integer({ min: 10, max: 80 }),
});

/**
 * Genera 4 puntos que forman un cuadrilátero convexo dentro de las dimensiones dadas.
 *
 * Estrategia: generar un centro y semi-ejes con perturbaciones pequeñas.
 * La convexidad se verifica con cross products.
 */
function convexQuadrilateralArb(maxWidth: number, maxHeight: number): fc.Arbitrary<[Point, Point, Point, Point]> {
  const marginX = Math.max(5, Math.floor(maxWidth * 0.1));
  const marginY = Math.max(5, Math.floor(maxHeight * 0.1));
  const maxHalfW = Math.max(6, Math.floor((maxWidth - 2 * marginX) / 3));
  const maxHalfH = Math.max(6, Math.floor((maxHeight - 2 * marginY) / 3));

  return fc.record({
    cx: fc.integer({ min: marginX + maxHalfW, max: Math.max(marginX + maxHalfW + 1, maxWidth - marginX - maxHalfW) }),
    cy: fc.integer({ min: marginY + maxHalfH, max: Math.max(marginY + maxHalfH + 1, maxHeight - marginY - maxHalfH) }),
    halfW: fc.integer({ min: 5, max: maxHalfW }),
    halfH: fc.integer({ min: 5, max: maxHalfH }),
    // Perturbaciones pequeñas para hacer formas no-rectangulares
    pertTLx: fc.integer({ min: -3, max: 3 }),
    pertTLy: fc.integer({ min: -3, max: 3 }),
    pertTRx: fc.integer({ min: -3, max: 3 }),
    pertTRy: fc.integer({ min: -3, max: 3 }),
    pertBRx: fc.integer({ min: -3, max: 3 }),
    pertBRy: fc.integer({ min: -3, max: 3 }),
    pertBLx: fc.integer({ min: -3, max: 3 }),
    pertBLy: fc.integer({ min: -3, max: 3 }),
  }).map(({ cx, cy, halfW, halfH, pertTLx, pertTLy, pertTRx, pertTRy, pertBRx, pertBRy, pertBLx, pertBLy }) => {
    const clampX = (v: number) => Math.max(0, Math.min(maxWidth - 1, v));
    const clampY = (v: number) => Math.max(0, Math.min(maxHeight - 1, v));

    const tl: Point = { x: clampX(cx - halfW + pertTLx), y: clampY(cy - halfH + pertTLy) };
    const tr: Point = { x: clampX(cx + halfW + pertTRx), y: clampY(cy - halfH + pertTRy) };
    const br: Point = { x: clampX(cx + halfW + pertBRx), y: clampY(cy + halfH + pertBRy) };
    const bl: Point = { x: clampX(cx - halfW + pertBLx), y: clampY(cy + halfH + pertBLy) };

    return [tl, tr, br, bl] as [Point, Point, Point, Point];
  }).filter((corners) => {
    // Verificar convexidad: todos los cross products deben tener el mismo signo
    const points = corners;
    let sign: number | null = null;

    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];
      const c = points[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

      if (Math.abs(cross) < 1) return false; // Casi colineal → descartar

      if (sign === null) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
    return true;
  });
}

// --- Property Tests ---

describe('Feature: v2-scanner-optimization, Property 8: Perspective transform produces valid rectangle', () => {
  it('applyPerspectiveTransform produces output with specified dimensions without throwing errors', () => {
    // Usar dimensiones fijas para el source para combinar con el generador de cuadriláteros
    const srcWidth = 100;
    const srcHeight = 100;
    const sourceCanvas = createMockSourceCanvas(srcWidth, srcHeight);

    fc.assert(
      fc.property(
        convexQuadrilateralArb(srcWidth, srcHeight),
        outputDimensionsArb,
        (corners, outDims) => {
          const result = applyPerspectiveTransform(
            sourceCanvas,
            corners,
            outDims.outputWidth,
            outDims.outputHeight
          );

          // Validar que el canvas de salida tiene las dimensiones especificadas
          expect(result.correctedCanvas.width).toBe(outDims.outputWidth);
          expect(result.correctedCanvas.height).toBe(outDims.outputHeight);

          // Validar que la transformMatrix tiene 9 elementos (3x3)
          expect(result.transformMatrix).toHaveLength(9);

          // Validar que el blob fue creado correctamente
          expect(result.correctedBlob).toBeInstanceOf(Blob);

          // Validar que todos los elementos de la matriz son números finitos
          for (const val of result.transformMatrix) {
            expect(Number.isFinite(val)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('applyPerspectiveTransform transform matrix is a valid 3x3 homography for any convex quadrilateral', () => {
    const srcWidth = 80;
    const srcHeight = 60;
    const sourceCanvas = createMockSourceCanvas(srcWidth, srcHeight);

    fc.assert(
      fc.property(
        convexQuadrilateralArb(srcWidth, srcHeight),
        outputDimensionsArb,
        (corners, outDims) => {
          const result = applyPerspectiveTransform(
            sourceCanvas,
            corners,
            outDims.outputWidth,
            outDims.outputHeight
          );

          // La matriz de transformación 3x3 siempre debe tener exactamente 9 elementos
          expect(result.transformMatrix).toHaveLength(9);

          // El último elemento debe ser 1 (normalización de la homografía)
          expect(result.transformMatrix[8]).toBe(1);

          // Todos los valores deben ser números finitos (no NaN, no Infinity)
          result.transformMatrix.forEach((val) => {
            expect(Number.isFinite(val)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
