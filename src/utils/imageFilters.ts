import type { FilterType } from '@/types';

interface FilterResult {
  canvas: HTMLCanvasElement;
  blob: Blob;
}

/**
 * Convierte ImageData a escala de grises usando la fórmula de luminancia estándar.
 * Para cada pixel: luminance = round(0.299*R + 0.587*G + 0.114*B)
 * Resultado: R = G = B = luminance, alpha sin cambios.
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  const output = new ImageData(
    new Uint8ClampedArray(data),
    imageData.width,
    imageData.height
  );
  const outputData = output.data;

  for (let i = 0; i < outputData.length; i += 4) {
    const r = outputData[i];
    const g = outputData[i + 1];
    const b = outputData[i + 2];
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    outputData[i] = luminance;
    outputData[i + 1] = luminance;
    outputData[i + 2] = luminance;
    // Alpha (i+3) permanece sin cambios
  }

  return output;
}

/**
 * Mejora blancos: aumenta brillo de áreas claras y oscurece áreas de texto
 * para lograr un aspecto de alto contraste estilo escáner.
 *
 * - Pixels con luminancia >= threshold: se empujan hacia 255 (más blancos)
 * - Pixels con luminancia < threshold: se oscurecen para aumentar contraste
 */
export function enhanceWhites(imageData: ImageData, threshold: number = 180): ImageData {
  const data = imageData.data;
  const output = new ImageData(
    new Uint8ClampedArray(data),
    imageData.width,
    imageData.height
  );
  const outputData = output.data;

  for (let i = 0; i < outputData.length; i += 4) {
    const r = outputData[i];
    const g = outputData[i + 1];
    const b = outputData[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance >= threshold) {
      // Área clara: empujar hacia blanco
      // Factor de brightening proporcional a qué tan cerca está del threshold
      const factor = 1 + (luminance - threshold) / (255 - threshold) * 0.5;
      outputData[i] = Math.min(255, Math.round(r * factor));
      outputData[i + 1] = Math.min(255, Math.round(g * factor));
      outputData[i + 2] = Math.min(255, Math.round(b * factor));
    } else {
      // Área oscura (texto): oscurecer para aumentar contraste
      const factor = 0.7 + (luminance / threshold) * 0.3;
      outputData[i] = Math.min(255, Math.round(r * factor));
      outputData[i + 1] = Math.min(255, Math.round(g * factor));
      outputData[i + 2] = Math.min(255, Math.round(b * factor));
    }
    // Alpha (i+3) permanece sin cambios
  }

  return output;
}

/**
 * Aplica un filtro al canvas fuente y retorna un nuevo canvas con el resultado + blob JPEG.
 *
 * Filtros disponibles:
 * - 'none': copia sin cambios
 * - 'grayscale': conversión a escala de grises con fórmula de luminancia
 * - 'whiteEnhance': mejora de blancos y oscurecimiento de texto
 * - 'grayscaleWhiteEnhance': composición secuencial (grayscale primero, luego whiteEnhance)
 */
export async function applyFilter(
  sourceCanvas: HTMLCanvasElement,
  filter: FilterType
): Promise<FilterResult> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Crear canvas de salida
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Error al crear contexto de canvas para aplicar el filtro');
  }

  // Obtener datos de la imagen fuente
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('Error al obtener contexto del canvas fuente');
  }

  const sourceImageData = sourceCtx.getImageData(0, 0, width, height);

  let resultImageData: ImageData;

  switch (filter) {
    case 'none':
      resultImageData = sourceImageData;
      break;

    case 'grayscale':
      resultImageData = toGrayscale(sourceImageData);
      break;

    case 'whiteEnhance':
      resultImageData = enhanceWhites(sourceImageData);
      break;

    case 'grayscaleWhiteEnhance':
      // Composición secuencial: grayscale primero, luego enhanceWhites
      const grayscaleResult = toGrayscale(sourceImageData);
      resultImageData = enhanceWhites(grayscaleResult);
      break;

    default:
      resultImageData = sourceImageData;
      break;
  }

  // Pintar resultado en el canvas de salida
  ctx.putImageData(resultImageData, 0, 0);

  // Convertir canvas a Blob JPEG
  const blob = await canvasToBlob(outputCanvas, 'image/jpeg', 0.92);

  return { canvas: outputCanvas, blob };
}

/**
 * Convierte un canvas a Blob usando una promesa.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Error al convertir canvas a blob'));
        }
      },
      type,
      quality
    );
  });
}
