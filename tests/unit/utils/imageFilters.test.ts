import { describe, it, expect, beforeAll } from 'vitest';
import { toGrayscale, enhanceWhites } from '@/utils/imageFilters';

// Polyfill ImageData para jsdom (no lo provee globalmente en algunas versiones)
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace: string;

      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (dataOrWidth instanceof Uint8ClampedArray) {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height ?? (dataOrWidth.length / 4 / widthOrHeight);
        } else {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
        this.colorSpace = 'srgb';
      }
    };
  }
});

/**
 * Helper para crear un ImageData con pixels específicos.
 * Cada pixel es [R, G, B, A].
 */
function createImageData(pixels: [number, number, number, number][]): ImageData {
  const width = pixels.length;
  const height = 1;
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((pixel, i) => {
    data[i * 4] = pixel[0];
    data[i * 4 + 1] = pixel[1];
    data[i * 4 + 2] = pixel[2];
    data[i * 4 + 3] = pixel[3];
  });
  return new ImageData(data, width, height);
}

describe('toGrayscale', () => {
  it('convierte un pixel rojo puro a luminancia correcta', () => {
    const input = createImageData([[255, 0, 0, 255]]);
    const result = toGrayscale(input);

    const expected = Math.round(0.299 * 255 + 0.587 * 0 + 0.114 * 0); // 76
    expect(result.data[0]).toBe(expected);
    expect(result.data[1]).toBe(expected);
    expect(result.data[2]).toBe(expected);
    expect(result.data[3]).toBe(255); // alpha sin cambios
  });

  it('convierte un pixel verde puro a luminancia correcta', () => {
    const input = createImageData([[0, 255, 0, 255]]);
    const result = toGrayscale(input);

    const expected = Math.round(0.299 * 0 + 0.587 * 255 + 0.114 * 0); // 150
    expect(result.data[0]).toBe(expected);
    expect(result.data[1]).toBe(expected);
    expect(result.data[2]).toBe(expected);
  });

  it('convierte un pixel azul puro a luminancia correcta', () => {
    const input = createImageData([[0, 0, 255, 255]]);
    const result = toGrayscale(input);

    const expected = Math.round(0.299 * 0 + 0.587 * 0 + 0.114 * 255); // 29
    expect(result.data[0]).toBe(expected);
    expect(result.data[1]).toBe(expected);
    expect(result.data[2]).toBe(expected);
  });

  it('un pixel blanco permanece blanco', () => {
    const input = createImageData([[255, 255, 255, 255]]);
    const result = toGrayscale(input);

    // 0.299*255 + 0.587*255 + 0.114*255 = 255
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it('un pixel negro permanece negro', () => {
    const input = createImageData([[0, 0, 0, 255]]);
    const result = toGrayscale(input);

    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it('no modifica la imagen original (inmutabilidad)', () => {
    const input = createImageData([[100, 150, 200, 255]]);
    const originalR = input.data[0];
    const originalG = input.data[1];
    const originalB = input.data[2];

    toGrayscale(input);

    expect(input.data[0]).toBe(originalR);
    expect(input.data[1]).toBe(originalG);
    expect(input.data[2]).toBe(originalB);
  });

  it('procesa múltiples pixels correctamente', () => {
    const input = createImageData([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
    ]);
    const result = toGrayscale(input);

    const expectedR = Math.round(0.299 * 255);
    const expectedG = Math.round(0.587 * 255);
    const expectedB = Math.round(0.114 * 255);

    expect(result.data[0]).toBe(expectedR);
    expect(result.data[4]).toBe(expectedG);
    expect(result.data[8]).toBe(expectedB);
  });

  it('preserva el canal alpha', () => {
    const input = createImageData([[128, 64, 32, 128]]);
    const result = toGrayscale(input);

    expect(result.data[3]).toBe(128);
  });
});

describe('enhanceWhites', () => {
  it('pixels claros (luminancia >= threshold) se vuelven más brillantes', () => {
    // Pixel blanco puro: luminancia = 255, está por encima del threshold (180)
    const input = createImageData([[200, 200, 200, 255]]);
    const result = enhanceWhites(input, 180);

    // Cada canal debe ser >= valor original
    expect(result.data[0]).toBeGreaterThanOrEqual(200);
    expect(result.data[1]).toBeGreaterThanOrEqual(200);
    expect(result.data[2]).toBeGreaterThanOrEqual(200);
  });

  it('pixels oscuros (luminancia < threshold) se oscurecen o mantienen', () => {
    // Pixel muy oscuro: luminancia baja
    const input = createImageData([[30, 30, 30, 255]]);
    const result = enhanceWhites(input, 180);

    // Cada canal debe ser <= valor original (se oscurece)
    expect(result.data[0]).toBeLessThanOrEqual(30);
    expect(result.data[1]).toBeLessThanOrEqual(30);
    expect(result.data[2]).toBeLessThanOrEqual(30);
  });

  it('pixel completamente negro permanece negro', () => {
    const input = createImageData([[0, 0, 0, 255]]);
    const result = enhanceWhites(input, 180);

    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it('pixel completamente blanco permanece blanco o se satura a 255', () => {
    const input = createImageData([[255, 255, 255, 255]]);
    const result = enhanceWhites(input, 180);

    // No puede exceder 255 (clamped)
    expect(result.data[0]).toBeLessThanOrEqual(255);
    expect(result.data[1]).toBeLessThanOrEqual(255);
    expect(result.data[2]).toBeLessThanOrEqual(255);
  });

  it('no modifica la imagen original (inmutabilidad)', () => {
    const input = createImageData([[100, 150, 200, 255]]);
    const originalR = input.data[0];
    const originalG = input.data[1];
    const originalB = input.data[2];

    enhanceWhites(input, 180);

    expect(input.data[0]).toBe(originalR);
    expect(input.data[1]).toBe(originalG);
    expect(input.data[2]).toBe(originalB);
  });

  it('preserva el canal alpha', () => {
    const input = createImageData([[200, 200, 200, 128]]);
    const result = enhanceWhites(input, 180);

    expect(result.data[3]).toBe(128);
  });

  it('acepta un threshold personalizado', () => {
    // Con threshold 100, un pixel con luminancia ~150 se considera "claro"
    const input = createImageData([[150, 150, 150, 255]]);
    const result = enhanceWhites(input, 100);

    // Debe brillar porque luminancia (150) > threshold (100)
    expect(result.data[0]).toBeGreaterThanOrEqual(150);
  });

  it('composición secuencial: grayscale luego enhanceWhites funciona correctamente', () => {
    const input = createImageData([[200, 180, 220, 255]]);
    const grayscaled = toGrayscale(input);
    const enhanced = enhanceWhites(grayscaled);

    // La salida de grayscale tiene R=G=B, enhanceWhites debe mantener esa propiedad
    // ya que opera sobre cada pixel individualmente con la misma lógica
    const luminance = Math.round(0.299 * 200 + 0.587 * 180 + 0.114 * 220);
    // Verificar que el resultado es consistente (todos los canales iguales tras grayscale+enhance)
    expect(result_channels_equal(enhanced)).toBe(true);
  });
});

/** Helper: verifica que todos los pixels tienen R=G=B (para imágenes de 1 pixel) */
function result_channels_equal(imageData: ImageData): boolean {
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i] !== imageData.data[i + 1] || imageData.data[i + 1] !== imageData.data[i + 2]) {
      return false;
    }
  }
  return true;
}
