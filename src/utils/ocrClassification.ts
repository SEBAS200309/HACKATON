import type { OcrResult } from '@/types';

/**
 * Severidad de confianza OCR.
 * - 'critical': confianza 0% o texto vacío → borde rojo
 * - 'warning': confianza >0% pero <80% → indicador amarillo
 * - 'normal': confianza ≥80% → sin indicador
 */
export type ConfidenceSeverity = 'critical' | 'warning' | 'normal';

/**
 * Clasifica la severidad de un resultado OCR basado en su confianza y texto extraído.
 *
 * Reglas:
 * - confidence === 0 OR extractedText vacío → 'critical' (borde rojo)
 * - confidence > 0 AND confidence < 80 → 'warning' (indicador amarillo)
 * - confidence >= 80 → 'normal' (sin indicador)
 */
export function classifyConfidenceSeverity(result: OcrResult): ConfidenceSeverity {
  if (result.confidence === 0 || result.extractedText.trim() === '') {
    return 'critical';
  }

  if (result.confidence > 0 && result.confidence < 80) {
    return 'warning';
  }

  return 'normal';
}
