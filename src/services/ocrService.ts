import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { storageService } from '@/services/storageService';
import type { TextractBlock, AreaOfInterest, OcrResult } from '@/types';

/**
 * OcrService — Servicio de procesamiento OCR con Amazon Textract
 * Estrategia: llamada única por documento completo + filtrado por BoundingBox
 */

export interface OcrService {
  processDocument(documentKey: string, areas: AreaOfInterest[]): Promise<OcrResult[]>;
  detectText(imageBytes: Buffer, s3Key?: string): Promise<TextractBlock[]>;
  filterBlocksByArea(blocks: TextractBlock[], area: AreaOfInterest): TextractBlock[];
  calculateAreaConfidence(blocks: TextractBlock[]): number;
}

class TextractOcrService implements OcrService {
  private client: TextractClient;

  constructor() {
    this.client = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Envía la imagen a Textract DetectDocumentText.
   * Si la imagen supera 5MB, la referencia desde S3. De lo contrario envía bytes directos.
   */
  async detectText(imageBytes: Buffer, s3Key?: string): Promise<TextractBlock[]> {
    try {
      const MAX_BYTES_SIZE = 5 * 1024 * 1024; // 5MB limit for Document.Bytes

      let command: DetectDocumentTextCommand;

      if (imageBytes.length > MAX_BYTES_SIZE && s3Key) {
        // Use S3 reference for large files
        command = new DetectDocumentTextCommand({
          Document: {
            S3Object: {
              Bucket: process.env.S3_BUCKET_NAME || '',
              Name: s3Key,
            },
          },
        });
      } else {
        // Send bytes directly for smaller files
        command = new DetectDocumentTextCommand({
          Document: {
            Bytes: imageBytes,
          },
        });
      }

      const response = await this.client.send(command);

      if (!response.Blocks) {
        return [];
      }

      const blocks: TextractBlock[] = response.Blocks
        .filter((block) => block.BlockType && block.Geometry?.BoundingBox)
        .map((block) => ({
          blockType: block.BlockType as 'PAGE' | 'LINE' | 'WORD',
          text: block.Text,
          confidence: block.Confidence ?? 0,
          boundingBox: {
            width: block.Geometry!.BoundingBox!.Width ?? 0,
            height: block.Geometry!.BoundingBox!.Height ?? 0,
            left: block.Geometry!.BoundingBox!.Left ?? 0,
            top: block.Geometry!.BoundingBox!.Top ?? 0,
          },
        }));

      return blocks;
    } catch (error) {
      throw new Error(
        `Error en el procesamiento OCR: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Filtra bloques de tipo WORD cuyo BoundingBox se superpone con el área de interés.
   * Fórmula de superposición:
   *   block.left < area.x + area.width AND
   *   block.left + block.width > area.x AND
   *   block.top < area.y + area.height AND
   *   block.top + block.height > area.y
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
   * Calcula la confianza del área como el mínimo de confianza de todos los bloques WORD.
   * Retorna 0 si no hay bloques.
   */
  calculateAreaConfidence(blocks: TextractBlock[]): number {
    const wordBlocks = blocks.filter((b) => b.blockType === 'WORD');

    if (wordBlocks.length === 0) {
      return 0;
    }

    return Math.min(...wordBlocks.map((b) => b.confidence));
  }

  /**
   * Orquesta el flujo completo de OCR:
   * 1. Obtener imagen del documento desde S3
   * 2. Enviar a Textract (una sola llamada)
   * 3. Filtrar bloques por cada área de interés
   * 4. Concatenar palabras en orden de lectura (top-to-bottom, left-to-right)
   * 5. Calcular confianza por área
   */
  async processDocument(documentKey: string, areas: AreaOfInterest[]): Promise<OcrResult[]> {
    try {
      // 1. Obtener imagen desde S3
      const imageBytes = await storageService.getObject(documentKey);

      // 2. Llamar a Textract una sola vez con el documento completo
      // Pass documentKey so large files can use S3 reference instead of bytes
      const allBlocks = await this.detectText(imageBytes, documentKey);

      // 3-5. Procesar cada área
      const results: OcrResult[] = areas.map((area) => {
        // Filtrar bloques WORD que se superponen con el área
        const areaBlocks = this.filterBlocksByArea(allBlocks, area);

        // Ordenar en orden de lectura: top-to-bottom, left-to-right
        const sortedBlocks = [...areaBlocks].sort((a, b) => {
          const topDiff = a.boundingBox.top - b.boundingBox.top;
          // Si la diferencia vertical es mínima (misma línea), ordenar por left
          if (Math.abs(topDiff) < 0.005) {
            return a.boundingBox.left - b.boundingBox.left;
          }
          return topDiff;
        });

        // Concatenar texto de las palabras ordenadas
        const extractedText = sortedBlocks
          .map((block) => block.text || '')
          .filter((text) => text.length > 0)
          .join(' ');

        // Calcular confianza mínima
        const confidence = this.calculateAreaConfidence(areaBlocks);

        return {
          variableName: area.variableName,
          extractedText,
          confidence,
          wordCount: sortedBlocks.filter((b) => b.text && b.text.length > 0).length,
        };
      });

      return results;
    } catch (error) {
      throw new Error(
        `Error en el procesamiento OCR del documento: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Singleton instance para uso en toda la aplicación
export const ocrService: OcrService = new TextractOcrService();
