import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TextractBlock, AreaOfInterest, OcrResult } from '@/types';
import { classifyConfidenceSeverity } from '@/utils/ocrClassification';

/**
 * Implementación local de filterBlocksByArea para testing directo de la lógica
 * de solapamiento sin depender del servicio Textract (que requiere AWS).
 * La lógica es idéntica a la de ocrService.filterBlocksByArea.
 */
function filterBlocksByArea(blocks: TextractBlock[], area: AreaOfInterest): TextractBlock[] {
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

// --- Generators ---

/**
 * Genera coordenadas normalizadas (0–1) válidas para un BoundingBox.
 * left + width <= 1, top + height <= 1
 */
const boundingBoxArb = fc.record({
  left: fc.double({ min: 0, max: 1, noNaN: true }),
  top: fc.double({ min: 0, max: 1, noNaN: true }),
  width: fc.double({ min: 0.001, max: 1, noNaN: true }),
  height: fc.double({ min: 0.001, max: 1, noNaN: true }),
}).filter((bb) => bb.left + bb.width <= 1 && bb.top + bb.height <= 1);

/**
 * Genera un TextractBlock de tipo WORD con BoundingBox normalizado.
 */
const wordBlockArb: fc.Arbitrary<TextractBlock> = boundingBoxArb.map((bb) => ({
  blockType: 'WORD' as const,
  text: 'test',
  confidence: 95,
  boundingBox: bb,
}));

/**
 * Genera un TextractBlock de tipo no-WORD (PAGE o LINE).
 */
const nonWordBlockArb: fc.Arbitrary<TextractBlock> = fc.record({
  blockType: fc.constantFrom('PAGE' as const, 'LINE' as const),
  text: fc.option(fc.string(), { nil: undefined }),
  confidence: fc.double({ min: 0, max: 100, noNaN: true }),
  boundingBox: boundingBoxArb,
});

/**
 * Genera un AreaOfInterest con coordenadas normalizadas (0–1).
 */
const areaArb: fc.Arbitrary<AreaOfInterest> = fc.record({
  id: fc.uuid(),
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
  width: fc.double({ min: 0.001, max: 1, noNaN: true }),
  height: fc.double({ min: 0.001, max: 1, noNaN: true }),
  variableName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  color: fc.constant('#a855f7'),
}).filter((a) => a.x + a.width <= 1 && a.y + a.height <= 1);

/**
 * Genera un OcrResult con confianza entre 0–100.
 */
const ocrResultArb: fc.Arbitrary<OcrResult> = fc.record({
  variableName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  extractedText: fc.string(),
  confidence: fc.integer({ min: 0, max: 100 }),
  wordCount: fc.nat({ max: 100 }),
});

// --- Property Tests ---

describe('Feature: document-digitization, Property 9: BoundingBox overlap detection', () => {
  /**
   * **Validates: Requirements 7.1**
   *
   * Para cualquier bloque WORD con BoundingBox y cualquier Area_de_Interes con
   * coordenadas normalizadas, la función de filtrado incluye el bloque si y solo si
   * se cumple la fórmula de solapamiento:
   *   block.left < area.x + area.width AND
   *   block.left + block.width > area.x AND
   *   block.top < area.y + area.height AND
   *   block.top + block.height > area.y
   */

  it('should include a WORD block if and only if the overlap formula holds', () => {
    fc.assert(
      fc.property(wordBlockArb, areaArb, (block, area) => {
        const bb = block.boundingBox;

        // Calcular solapamiento esperado según la fórmula
        const expectedOverlap =
          bb.left < area.x + area.width &&
          bb.left + bb.width > area.x &&
          bb.top < area.y + area.height &&
          bb.top + bb.height > area.y;

        // Ejecutar el filtro
        const result = filterBlocksByArea([block], area);

        // El bloque debe incluirse si y solo si la fórmula se cumple
        if (expectedOverlap) {
          expect(result).toHaveLength(1);
          expect(result[0]).toEqual(block);
        } else {
          expect(result).toHaveLength(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('should never include non-WORD blocks regardless of overlap', () => {
    fc.assert(
      fc.property(nonWordBlockArb, areaArb, (block, area) => {
        const result = filterBlocksByArea([block], area);
        expect(result).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly filter a mixed set of blocks', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(wordBlockArb, nonWordBlockArb), { minLength: 1, maxLength: 20 }),
        areaArb,
        (blocks, area) => {
          const result = filterBlocksByArea(blocks, area);

          // Todos los bloques retornados deben ser WORD
          for (const block of result) {
            expect(block.blockType).toBe('WORD');
          }

          // Todos los WORD blocks del resultado deben cumplir la fórmula
          for (const block of result) {
            const bb = block.boundingBox;
            expect(bb.left < area.x + area.width).toBe(true);
            expect(bb.left + bb.width > area.x).toBe(true);
            expect(bb.top < area.y + area.height).toBe(true);
            expect(bb.top + bb.height > area.y).toBe(true);
          }

          // Todos los WORD blocks que cumplen la fórmula deben estar en el resultado
          const expectedWords = blocks.filter((b) => {
            if (b.blockType !== 'WORD') return false;
            const bb = b.boundingBox;
            return (
              bb.left < area.x + area.width &&
              bb.left + bb.width > area.x &&
              bb.top < area.y + area.height &&
              bb.top + bb.height > area.y
            );
          });

          expect(result).toHaveLength(expectedWords.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: document-digitization, Property 10: OCR confidence severity classification', () => {
  /**
   * **Validates: Requirements 7.6, 8.3, 8.9**
   *
   * Para cualquier resultado OCR con una puntuación de confianza:
   * (a) critical (rojo) si confidence === 0% o texto vacío
   * (b) warning (amarillo) si confidence >0% pero <80%
   * (c) normal (sin indicador) si confidence ≥80%
   */

  it('should classify confidence=0 as critical regardless of text', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
        fc.nat({ max: 100 }),
        (text, varName, wordCount) => {
          const result: OcrResult = {
            variableName: varName,
            extractedText: text,
            confidence: 0,
            wordCount,
          };
          expect(classifyConfidenceSeverity(result)).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify empty text as critical regardless of confidence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
        fc.nat({ max: 100 }),
        // Generamos texto vacío o solo whitespace
        fc.constantFrom('', ' ', '  ', '\t', '\n', '  \t\n  '),
        (confidence, varName, wordCount, emptyText) => {
          const result: OcrResult = {
            variableName: varName,
            extractedText: emptyText,
            confidence,
            wordCount,
          };
          expect(classifyConfidenceSeverity(result)).toBe('critical');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify confidence >0 and <80 with non-empty text as warning', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 79 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
        fc.nat({ max: 100 }),
        (confidence, text, varName, wordCount) => {
          const result: OcrResult = {
            variableName: varName,
            extractedText: text,
            confidence,
            wordCount,
          };
          expect(classifyConfidenceSeverity(result)).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should classify confidence >=80 with non-empty text as normal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
        fc.nat({ max: 100 }),
        (confidence, text, varName, wordCount) => {
          const result: OcrResult = {
            variableName: varName,
            extractedText: text,
            confidence,
            wordCount,
          };
          expect(classifyConfidenceSeverity(result)).toBe('normal');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exhaustively cover all classification ranges for any OcrResult', () => {
    fc.assert(
      fc.property(ocrResultArb, (result) => {
        const severity = classifyConfidenceSeverity(result);

        // La severidad debe ser uno de los tres valores posibles
        expect(['critical', 'warning', 'normal']).toContain(severity);

        // Verificar la clasificación correcta
        if (result.confidence === 0 || result.extractedText.trim() === '') {
          expect(severity).toBe('critical');
        } else if (result.confidence > 0 && result.confidence < 80) {
          expect(severity).toBe('warning');
        } else {
          expect(severity).toBe('normal');
        }
      }),
      { numRuns: 200 }
    );
  });
});
