import { PaddleOcrService, V5_LATIN_MOBILE_MODEL } from 'ppu-paddle-ocr';
import type { PaddleOcrResult } from 'ppu-paddle-ocr';
import { storageService } from '@/services/storageService';
import type { OcrService } from '@/services/ocrService';
import type { TextractBlock, AreaOfInterest, OcrResult } from '@/types';

/**
 * PaddleOcrServiceImpl — Servicio OCR usando ppu-paddle-ocr (reemplaza Tesseract.js)
 * Estrategia: recorte por zona con sharp + reconocimiento individual por región
 *
 * Ejecuta en Node.js (API Routes / Lambda). Reutiliza instancia entre invocaciones warm.
 */

const OCR_TIMEOUT_MS = 55_000; // 55 segundos

// Singleton PaddleOCR service (reutilizar entre invocaciones)
let paddleService: InstanceType<typeof PaddleOcrService> | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Inicializa el servicio PaddleOCR con modelo latin mobile.
 * Usa patrón singleton con lazy init para reutilizar entre invocaciones Lambda warm.
 */
async function initialize(): Promise<InstanceType<typeof PaddleOcrService>> {
  if (paddleService) return paddleService;

  // Prevenir inicializaciones concurrentes
  if (isInitializing && initPromise) {
    await initPromise;
    if (paddleService) return paddleService;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const service = new PaddleOcrService({
        model: V5_LATIN_MOBILE_MODEL,
      });
      await service.initialize();
      paddleService = service;
    } catch (error) {
      isInitializing = false;
      initPromise = null;
      throw new Error(
        `Error: no se pudo inicializar el motor OCR: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      isInitializing = false;
    }
  })();

  await initPromise;
  initPromise = null;

  if (!paddleService) throw new Error('Error: no se pudo inicializar el motor OCR');
  return paddleService;
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

class PaddleOcrServiceImpl implements OcrService {
  /**
   * Orquesta el flujo completo de OCR usando Rectangle Mode:
   * Para cada zona, recorta la región con sharp y ejecuta OCR en el fragmento.
   *
   * Flujo:
   * 1. Obtener imagen del documento desde S3
   * 2. Obtener dimensiones con sharp metadata
   * 3. Para cada zona: recortar con sharp → OCR en la región recortada
   * 4. Retornar texto y confianza de cada región
   */
  async processDocument(documentKey: string, areas: AreaOfInterest[]): Promise<OcrResult[]> {
    const imageBytes = await storageService.getObject(documentKey);
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imageBytes).metadata();
    const imgWidth = metadata.width || 2048;
    const imgHeight = metadata.height || 2048;

    const service = await initialize();
    const results: OcrResult[] = [];

    for (const area of areas) {
      try {
        // Convertir coordenadas normalizadas (0-1) a pixels
        const left = Math.round(area.x * imgWidth);
        const top = Math.round(area.y * imgHeight);
        const width = Math.round(area.width * imgWidth);
        const height = Math.round(area.height * imgHeight);

        // Clamp valores para asegurar validez
        const clampedLeft = Math.max(0, Math.min(left, imgWidth - 1));
        const clampedTop = Math.max(0, Math.min(top, imgHeight - 1));
        const clampedWidth = Math.max(1, Math.min(width, imgWidth - clampedLeft));
        const clampedHeight = Math.max(1, Math.min(height, imgHeight - clampedTop));

        // Recortar la región con sharp y convertir a PNG
        const croppedBuffer = await sharp(imageBytes)
          .extract({ left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight })
          .png()
          .toBuffer();

        // Convertir Buffer a ArrayBuffer para PaddleOCR
        const arrayBuffer = croppedBuffer.buffer.slice(
          croppedBuffer.byteOffset,
          croppedBuffer.byteOffset + croppedBuffer.byteLength
        ) as ArrayBuffer;

        // Ejecutar OCR en la región recortada con timeout
        const ocrResult = await withTimeout(
          service.recognize(arrayBuffer) as Promise<PaddleOcrResult>,
          OCR_TIMEOUT_MS
        );

        console.log(`[OCR] Zone "${area.variableName}": text="${ocrResult.text.trim()}", confidence=${ocrResult.confidence}`);

        results.push({
          variableName: area.variableName,
          extractedText: ocrResult.text.trim(),
          confidence: Math.round(ocrResult.confidence * 100),
          wordCount: ocrResult.text.trim().split(/\s+/).filter(w => w.length > 0).length,
        });
      } catch (error) {
        console.error(`Error procesando zona ${area.variableName}:`, error);
        results.push({
          variableName: area.variableName,
          extractedText: '',
          confidence: 0,
          wordCount: 0,
        });
      }
    }

    return results;
  }

  /**
   * Ejecuta OCR sobre los bytes de la imagen completa.
   * Convierte los resultados de PaddleOCR al formato TextractBlock[].
   */
  async detectText(imageBytes: Buffer): Promise<TextractBlock[]> {
    const service = await initialize();
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(imageBytes).metadata();
    const imgWidth = metadata.width || 2048;
    const imgHeight = metadata.height || 2048;

    const pngBuffer = await sharp(imageBytes).png().toBuffer();
    const arrayBuffer = pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength) as ArrayBuffer;
    const result = await withTimeout(
      service.recognize(arrayBuffer) as Promise<PaddleOcrResult>,
      OCR_TIMEOUT_MS
    );

    const blocks: TextractBlock[] = [];

    // Convertir resultados PaddleOCR al formato TextractBlock
    if ('lines' in result) {
      for (const line of result.lines) {
        for (const item of line) {
          blocks.push({
            blockType: 'WORD',
            text: item.text,
            confidence: item.confidence * 100,
            boundingBox: {
              left: item.box.x / imgWidth,
              top: item.box.y / imgHeight,
              width: item.box.width / imgWidth,
              height: item.box.height / imgHeight,
            },
          });
        }
      }
    }

    return blocks;
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
}

// Singleton instance para uso en toda la aplicación
export const ocrService: OcrService = new PaddleOcrServiceImpl();
