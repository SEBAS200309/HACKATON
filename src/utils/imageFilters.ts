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
 * Mejora blancos estilo CamScanner: usa umbralización adaptativa para producir
 * un fondo blanco puro con texto negro nítido, simulando un escáner profesional.
 *
 * Usa Integral Image (Summed Area Table) para calcular promedios locales en O(1)
 * por pixel, haciendo el algoritmo completo O(N) en vez de O(N × blockSize²).
 *
 * Propiedades mantenidas para compatibilidad:
 * - Pixels claros (luminancia >= threshold): output >= input (empujados a blanco)
 * - Pixels oscuros (luminancia < threshold): output <= input (oscurecidos)
 * - Alpha sin cambios
 */
export function enhanceWhites(imageData: ImageData, threshold: number = 160): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );
  const outputData = output.data;

  const totalPixels = width * height;

  // Paso 1: Calcular mapa de luminancia
  const luminanceMap = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    luminanceMap[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Para imágenes muy pequeñas (< 10 pixels), usar umbralización global simple
  if (totalPixels < 10) {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const lum = luminanceMap[i];

      if (lum >= threshold) {
        const factor = 1 + ((lum - threshold) / (255 - threshold)) * 1.5;
        outputData[idx] = Math.min(255, Math.round(data[idx] * factor));
        outputData[idx + 1] = Math.min(255, Math.round(data[idx + 1] * factor));
        outputData[idx + 2] = Math.min(255, Math.round(data[idx + 2] * factor));
      } else {
        const factor = Math.pow(lum / threshold, 1.5) * 0.6;
        outputData[idx] = Math.min(255, Math.round(data[idx] * factor));
        outputData[idx + 1] = Math.min(255, Math.round(data[idx + 1] * factor));
        outputData[idx + 2] = Math.min(255, Math.round(data[idx + 2] * factor));
      }
    }
    return output;
  }

  // Paso 2: Construir Integral Image (Summed Area Table) — O(N)
  // integral[y][x] = sum of all luminance values from (0,0) to (x,y)
  const integral = new Float64Array((width + 1) * (height + 1));
  const iw = width + 1; // integral width stride

  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += luminanceMap[(y - 1) * width + (x - 1)];
      integral[y * iw + x] = rowSum + integral[(y - 1) * iw + x];
    }
  }

  // Paso 3: Calcular umbral adaptativo local usando integral image — O(1) por pixel
  const halfBlock = Math.max(7, Math.round(Math.min(width, height) / 60));

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const y = Math.floor(i / width);
    const x = i % width;
    const lum = luminanceMap[i];

    // Definir ventana del vecindario (clamped a bordes)
    const y1 = Math.max(0, y - halfBlock);
    const y2 = Math.min(height - 1, y + halfBlock);
    const x1 = Math.max(0, x - halfBlock);
    const x2 = Math.min(width - 1, x + halfBlock);

    // Calcular promedio local usando integral image en O(1)
    const sum = integral[(y2 + 1) * iw + (x2 + 1)]
              - integral[y1 * iw + (x2 + 1)]
              - integral[(y2 + 1) * iw + x1]
              + integral[y1 * iw + x1];
    const count = (y2 - y1 + 1) * (x2 - x1 + 1);
    const localMean = sum / count;

    // Umbral adaptativo = promedio local - offset
    const localThresh = Math.min(localMean - 25, threshold);

    // Clasificar pixel y aplicar transformación
    if (lum > localThresh + 20) {
      // Fondo claro → blanco puro
      outputData[idx] = 255;
      outputData[idx + 1] = 255;
      outputData[idx + 2] = 255;
    } else if (lum < localThresh - 15) {
      // Texto oscuro → negro profundo
      const darkValue = Math.max(0, Math.round(lum * 0.3));
      outputData[idx] = darkValue;
      outputData[idx + 1] = darkValue;
      outputData[idx + 2] = darkValue;
    } else {
      // Zona de transición → sigmoide suave
      const normalized = (lum - localThresh) / 30;
      const sigmoid = 1 / (1 + Math.exp(-12 * normalized));
      const outputValue = Math.round(sigmoid * 255);
      outputData[idx] = outputValue;
      outputData[idx + 1] = outputValue;
      outputData[idx + 2] = outputValue;
    }
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
