import type { TextractBlock, AreaOfInterest, OcrResult } from '@/types';

/**
 * OcrService — Interfaz del servicio de procesamiento OCR.
 * Implementada por PaddleOcrService en tesseractOcrService.ts.
 */
export interface OcrService {
  processDocument(documentKey: string, areas: AreaOfInterest[]): Promise<OcrResult[]>;
  detectText(imageBytes: Buffer, s3Key?: string): Promise<TextractBlock[]>;
  filterBlocksByArea(blocks: TextractBlock[], area: AreaOfInterest): TextractBlock[];
  calculateAreaConfidence(blocks: TextractBlock[]): number;
}
