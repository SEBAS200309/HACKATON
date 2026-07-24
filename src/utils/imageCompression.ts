/**
 * Módulo de compresión inteligente de imágenes.
 * Reduce el tamaño de archivo manteniendo un mínimo de 150 DPI usando Canvas API.
 * Implementa reducción iterativa de calidad y dimensiones hasta cumplir maxFileSizeMB.
 */

export interface CompressionOptions {
  maxWidth: number;       // default: 2048px
  maxHeight: number;      // default: 2048px
  quality: number;        // 0-1, default: 0.85
  minDPI: number;         // default: 150
  maxFileSizeMB: number;  // default: 2
}

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  minDPI: 150,
  maxFileSizeMB: 2,
};

/**
 * Determina si un archivo necesita compresión.
 * Retorna true si el tamaño del archivo excede 2MB.
 */
export function shouldCompress(file: File): boolean {
  const TWO_MB = 2 * 1024 * 1024;
  return file.size > TWO_MB;
}

/**
 * Comprime una imagen reduciendo tamaño manteniendo mínimo 150 DPI.
 * Usa Canvas API para redimensionar y reducir calidad de forma iterativa
 * hasta que el resultado cumpla con maxFileSizeMB.
 */
export async function compressImage(
  file: File,
  options?: Partial<CompressionOptions>
): Promise<CompressionResult> {
  const opts: CompressionOptions = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;
  const maxSizeBytes = opts.maxFileSizeMB * 1024 * 1024;

  // Cargar imagen desde el archivo
  const imageBitmap = await createImageBitmapFromFile(file);
  const originalWidth = imageBitmap.width;
  const originalHeight = imageBitmap.height;

  // Calcular dimensiones iniciales respetando maxWidth/maxHeight
  let { width, height } = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Calcular el tamaño mínimo permitido para mantener minDPI
  // Asumimos que el documento original tiene un tamaño físico fijo.
  // DPI efectivo = pixeles / (pixeles_originales / DPI_original)
  // Para mantener >= minDPI, no reducimos más allá de cierto punto.
  const minScale = calculateMinScale(originalWidth, originalHeight, opts.minDPI);

  let quality = opts.quality;
  let blob: Blob | null = null;

  // Iteración: reducir calidad primero, luego dimensiones
  const maxIterations = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    blob = await renderToBlob(imageBitmap, width, height, quality);

    // Si cumple con el tamaño máximo, terminamos
    if (blob.size <= maxSizeBytes) {
      break;
    }

    iteration++;

    // Primero intentar reducir calidad (en pasos de 0.05)
    if (quality > 0.3) {
      quality = Math.max(0.3, quality - 0.05);
      continue;
    }

    // Si la calidad ya está al mínimo, reducir dimensiones (en pasos de 10%)
    const scaleFactor = 0.9;
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);

    // Verificar que no bajemos del mínimo DPI
    const scaleFromOriginal = newWidth / originalWidth;
    if (scaleFromOriginal < minScale) {
      // No podemos reducir más sin violar minDPI
      break;
    }

    width = newWidth;
    height = newHeight;
  }

  // Si no se logró producir blob en el loop (no debería pasar), hacer render final
  if (!blob) {
    blob = await renderToBlob(imageBitmap, width, height, quality);
  }

  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    width,
    height,
  };
}

/**
 * Carga un archivo de imagen y retorna un ImageBitmap.
 */
async function createImageBitmapFromFile(file: File): Promise<ImageBitmap> {
  // Usar createImageBitmap si está disponible (navegadores modernos)
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  // Fallback con Image element
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      // Crear un canvas para obtener un bitmap-like object
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener contexto 2D del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      // Retornar como ImageBitmap-compatible (canvas dimensions)
      resolve(img as unknown as ImageBitmap);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };

    img.src = url;
  });
}

/**
 * Calcula dimensiones manteniendo aspect ratio dentro de los límites.
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Si ya está dentro de los límites, no redimensionar
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const aspectRatio = width / height;

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}

/**
 * Calcula la escala mínima permitida para mantener el DPI mínimo.
 * Asumimos que la imagen original se capturó a ~300 DPI como estándar.
 * Para mantener minDPI, la escala mínima es minDPI / assumedOriginalDPI.
 */
function calculateMinScale(
  _originalWidth: number,
  _originalHeight: number,
  minDPI: number
): number {
  // Asumir que la imagen original tiene ~300 DPI (estándar para documentos)
  const assumedOriginalDPI = 300;
  return minDPI / assumedOriginalDPI;
}

/**
 * Renderiza un ImageBitmap al tamaño especificado y retorna un Blob JPEG.
 */
async function renderToBlob(
  source: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo obtener contexto 2D del canvas');
  }

  ctx.drawImage(source, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo generar el blob de la imagen comprimida'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}
