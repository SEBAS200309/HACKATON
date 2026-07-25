import Tesseract from 'tesseract.js';
import { storageService } from '@/services/storageService';
import type { OcrService } from '@/services/ocrService';
import type { TextractBlock, AreaOfInterest, OcrResult } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

const { createWorker } = Tesseract;

/**
 * TesseractOcrService — Servicio OCR usando Tesseract.js (reemplaza Amazon Textract)
 * Estrategia: llamada única por documento completo + filtrado por BoundingBox
 * 
 * Ejecuta en Node.js (API Routes / Lambda). Reutiliza worker entre invocaciones warm.
 */

const OCR_TIMEOUT_MS = 55_000; // 55 segundos

// Módulo-level singleton para reutilizar worker entre invocaciones Lambda warm
let workerInstance: Tesseract.Worker | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Obtiene la ruta del traineddata para español.
 * Intenta primero desde el bundle local, luego descarga desde S3 con caché en /tmp.
 */
async function getTrainedDataPath(): Promise<string> {
  // Opción 1: Archivo bundleado junto al código (ideal para desarrollo y despliegue)
  const bundledPaths = [
    path.join(process.cwd(), 'trained-data', 'spa.traineddata'),
    path.join(process.cwd(), 'public', 'trained-data', 'spa.traineddata'),
    path.join(__dirname, '..', '..', 'trained-data', 'spa.traineddata'),
  ];

  for (const bundledPath of bundledPaths) {
    if (fs.existsSync(bundledPath)) {
      // Normalizar a forward slashes para compatibilidad con tesseract.js
      return path.dirname(bundledPath).replace(/\\/g, '/');
    }
  }

  // Opción 2: Caché en /tmp (Lambda warm invocations)
  const tmpDir = path.join('/tmp', 'tesseract-data');
  const tmpFile = path.join(tmpDir, 'spa.traineddata');

  if (fs.existsSync(tmpFile)) {
    return tmpDir.replace(/\\/g, '/');
  }

  // Opción 3: Descargar desde S3 y cachear en /tmp
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const trainedDataBuffer = await storageService.getObject('trained-data/spa.traineddata');
    fs.writeFileSync(tmpFile, trainedDataBuffer);
    return tmpDir.replace(/\\/g, '/');
  } catch (error) {
    // Si no hay traineddata disponible, usar el path por defecto de Tesseract.js
    // (intentará descargar automáticamente — puede fallar si CDN no tiene la versión)
    console.error('No se pudo obtener spa.traineddata:', error instanceof Error ? error.message : String(error));
    return '';
  }
}

/**
 * Inicializa el worker de Tesseract.js con configuración para español.
 * Usa patrón singleton con lazy init para reutilizar entre invocaciones Lambda warm.
 */
async function initialize(): Promise<Tesseract.Worker> {
  if (workerInstance) {
    return workerInstance;
  }

  // Prevenir inicializaciones concurrentes
  if (isInitializing && initPromise) {
    await initPromise;
    if (workerInstance) {
      return workerInstance;
    }
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      const langPath = await getTrainedDataPath();

      const workerOptions: Record<string, unknown> = {
        gzip: false,
      };

      if (langPath) {
        workerOptions.langPath = langPath;
        workerOptions.cachePath = langPath;
      }

      // Timeout para inicialización (30s) — cargar traineddata puede tomar tiempo
      const initTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al inicializar worker OCR')), 30_000);
      });

      const worker = await Promise.race([
        createWorker('spa', 1, workerOptions as any),
        initTimeout,
      ]) as Tesseract.Worker;

      workerInstance = worker;
    } catch (error) {
      isInitializing = false;
      initPromise = null;
      throw new Error(
        `Error: no se pudo inicializar el motor OCR. Contacte al administrador. Detalle: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isInitializing = false;
    }
  })();

  await initPromise;
  initPromise = null;

  if (!workerInstance) {
    throw new Error('Error: no se pudo inicializar el motor OCR. Contacte al administrador');
  }

  return workerInstance;
}

/**
 * Timeout guard que cancela operaciones que excedan el tiempo límite.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        'Error: el procesamiento OCR excedió el tiempo límite. Intente con una imagen de menor resolución'
      ));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Convierte el output de Tesseract.js al formato TextractBlock[].
 * Normaliza coordenadas BoundingBox al rango 0-1 dividiendo por dimensiones de imagen.
 */
function mapTesseractOutput(
  pageData: Tesseract.Page,
  imageWidth: number,
  imageHeight: number
): TextractBlock[] {
  const blocks: TextractBlock[] = [];

  // Agregar bloque PAGE
  blocks.push({
    blockType: 'PAGE',
    text: pageData.text,
    confidence: pageData.confidence,
    boundingBox: {
      width: 1,
      height: 1,
      left: 0,
      top: 0,
    },
  });

  // Agregar bloques LINE
  if (pageData.lines) {
    for (const line of pageData.lines) {
      const bbox = line.bbox;
      blocks.push({
        blockType: 'LINE',
        text: line.text,
        confidence: line.confidence,
        boundingBox: {
          left: bbox.x0 / imageWidth,
          top: bbox.y0 / imageHeight,
          width: (bbox.x1 - bbox.x0) / imageWidth,
          height: (bbox.y1 - bbox.y0) / imageHeight,
        },
      });
    }
  }

  // Agregar bloques WORD
  if (pageData.words) {
    for (const word of pageData.words) {
      const bbox = word.bbox;
      blocks.push({
        blockType: 'WORD',
        text: word.text,
        confidence: word.confidence,
        boundingBox: {
          left: bbox.x0 / imageWidth,
          top: bbox.y0 / imageHeight,
          width: (bbox.x1 - bbox.x0) / imageWidth,
          height: (bbox.y1 - bbox.y0) / imageHeight,
        },
      });
    }
  }

  return blocks;
}

class TesseractOcrService implements OcrService {
  /**
   * Ejecuta OCR sobre los bytes de la imagen.
   * Si el archivo > 5MB y hay s3Key, obtiene la imagen desde S3 directamente.
   */
  async detectText(imageBytes: Buffer, s3Key?: string): Promise<TextractBlock[]> {
    try {
      const MAX_BYTES_SIZE = 5 * 1024 * 1024; // 5MB

      let bytesToProcess = imageBytes;

      // Para archivos > 5MB, usar referencia S3 si está disponible
      if (imageBytes.length > MAX_BYTES_SIZE && s3Key) {
        bytesToProcess = await storageService.getObject(s3Key);
      }

      const worker = await initialize();

      // Ejecutar reconocimiento con timeout
      const result: Tesseract.RecognizeResult = await withTimeout(
        worker.recognize(bytesToProcess),
        OCR_TIMEOUT_MS
      );

      // Obtener dimensiones de la imagen para normalización
      const dimensions = getImageDimensions(bytesToProcess);

      // Convertir output de Tesseract al formato TextractBlock
      return mapTesseractOutput(result.data, dimensions.width, dimensions.height);
    } catch (error) {
      if (error instanceof Error && error.message.includes('tiempo límite')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('no se pudo inicializar')) {
        throw error;
      }
      throw new Error(
        `Error en el procesamiento OCR: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Filtra bloques de tipo WORD cuyo BoundingBox se superpone con el área de interés.
   */
  filterBlocksByArea(blocks: TextractBlock[], area: AreaOfInterest): TextractBlock[] {
    return blocks.filter((block) => {
      if (block.blockType !== 'WORD') {
        return false;
      }

      const bb = block.boundingBox;

      const overlapsHorizontally =
        bb.left < area.x + area.width && bb.left + bb.width > area.x;

      const overlapsVertically =
        bb.top < area.y + area.height && bb.top + bb.height > area.y;

      return overlapsHorizontally && overlapsVertically;
    });
  }

  /**
   * Calcula la confianza del área como el PROMEDIO de confianza de bloques WORD filtrados.
   * Retorna 0 si no hay bloques.
   */
  calculateAreaConfidence(blocks: TextractBlock[]): number {
    const wordBlocks = blocks.filter((b) => b.blockType === 'WORD');

    if (wordBlocks.length === 0) {
      return 0;
    }

    const totalConfidence = wordBlocks.reduce((sum, b) => sum + b.confidence, 0);
    return totalConfidence / wordBlocks.length;
  }

  /**
   * Orquesta el flujo completo de OCR usando Rectangle Mode:
   * Para cada zona, ejecuta OCR solo en esa región específica de la imagen.
   * Esto da máxima precisión porque Tesseract solo analiza el texto dentro del recuadro.
   * 
   * Flujo:
   * 1. Obtener imagen del documento desde S3
   * 2. Obtener dimensiones de la imagen
   * 3. Para cada zona: convertir coordenadas (0-1) a pixels, llamar recognize con rectangle
   * 4. Extraer texto directamente del resultado
   */
  async processDocument(documentKey: string, areas: AreaOfInterest[]): Promise<OcrResult[]> {
    try {
      // 1. Obtener imagen desde S3
      const imageBytes = await storageService.getObject(documentKey);

      // 2. Obtener dimensiones reales de la imagen
      const dimensions = getImageDimensions(imageBytes);

      // 3. Inicializar worker
      const worker = await initialize();

      // 4. Procesar cada zona individualmente usando rectangle
      const results: OcrResult[] = [];

      for (const area of areas) {
        try {
          // Convertir coordenadas normalizadas (0-1) a pixels
          const left = Math.round(area.x * dimensions.width);
          const top = Math.round(area.y * dimensions.height);
          const width = Math.round(area.width * dimensions.width);
          const height = Math.round(area.height * dimensions.height);

          // Asegurar que las coordenadas sean válidas
          const clampedLeft = Math.max(0, Math.min(left, dimensions.width - 1));
          const clampedTop = Math.max(0, Math.min(top, dimensions.height - 1));
          const clampedWidth = Math.max(1, Math.min(width, dimensions.width - clampedLeft));
          const clampedHeight = Math.max(1, Math.min(height, dimensions.height - clampedTop));

          // OCR solo en la región del recuadro
          const result: Tesseract.RecognizeResult = await withTimeout(
            worker.recognize(imageBytes, {
              rectangle: {
                left: clampedLeft,
                top: clampedTop,
                width: clampedWidth,
                height: clampedHeight,
              },
            }),
            OCR_TIMEOUT_MS
          );

          // Extraer texto directamente (ya es solo de la zona)
          const extractedText = (result.data.text || '').trim();
          const confidence = result.data.confidence || 0;
          const wordCount = result.data.words?.length || 0;

          results.push({
            variableName: area.variableName,
            extractedText,
            confidence,
            wordCount,
          });
        } catch (areaError) {
          // Si falla una zona, continuar con las demás y reportar texto vacío
          console.error(`Error procesando zona ${area.variableName}:`, areaError);
          results.push({
            variableName: area.variableName,
            extractedText: '',
            confidence: 0,
            wordCount: 0,
          });
        }
      }

      return results;
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('tiempo límite') ||
        error.message.includes('no se pudo inicializar')
      )) {
        throw error;
      }
      throw new Error(
        `Error en el procesamiento OCR del documento: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Obtiene las dimensiones de una imagen desde sus bytes.
 * Soporta PNG, JPEG, BMP, TIFF, y WebP.
 * Si no puede determinar las dimensiones, usa valores por defecto razonables.
 */
function getImageDimensions(imageBytes: Buffer): { width: number; height: number } {
  // PNG: bytes 16-23 contienen width (4 bytes) y height (4 bytes) en big-endian
  if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47) {
    const width = imageBytes.readUInt32BE(16);
    const height = imageBytes.readUInt32BE(20);
    return { width, height };
  }

  // JPEG: buscar marcador SOF0 (0xFF 0xC0) o SOF2 (0xFF 0xC2)
  if (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8) {
    let offset = 2;
    while (offset < imageBytes.length - 9) {
      if (imageBytes[offset] === 0xFF) {
        const marker = imageBytes[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = imageBytes.readUInt16BE(offset + 5);
          const width = imageBytes.readUInt16BE(offset + 7);
          return { width, height };
        }
        // Saltar al siguiente marcador
        const segmentLength = imageBytes.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      } else {
        offset++;
      }
    }
  }

  // BMP: bytes 18-21 = width, 22-25 = height (little-endian)
  if (imageBytes[0] === 0x42 && imageBytes[1] === 0x4D) {
    const width = imageBytes.readUInt32LE(18);
    const height = Math.abs(imageBytes.readInt32LE(22));
    return { width, height };
  }

  // TIFF: puede ser little-endian (II) o big-endian (MM)
  if ((imageBytes[0] === 0x49 && imageBytes[1] === 0x49) ||
      (imageBytes[0] === 0x4D && imageBytes[1] === 0x4D)) {
    // Simplificación: retornar valor por defecto para TIFF
    return { width: 2048, height: 2048 };
  }

  // WebP: bytes 24-27 = width (little-endian), depende del formato
  if (imageBytes[0] === 0x52 && imageBytes[1] === 0x49 &&
      imageBytes[2] === 0x46 && imageBytes[3] === 0x46 &&
      imageBytes[8] === 0x57 && imageBytes[9] === 0x45 &&
      imageBytes[10] === 0x42 && imageBytes[11] === 0x50) {
    // VP8 lossy
    if (imageBytes[12] === 0x56 && imageBytes[13] === 0x50 &&
        imageBytes[14] === 0x38 && imageBytes[15] === 0x20) {
      const width = imageBytes.readUInt16LE(26) & 0x3FFF;
      const height = imageBytes.readUInt16LE(28) & 0x3FFF;
      return { width, height };
    }
  }

  // Fallback: valor por defecto razonable
  return { width: 2048, height: 2048 };
}

// Singleton instance para uso en toda la aplicación
export const ocrService: OcrService = new TesseractOcrService();
