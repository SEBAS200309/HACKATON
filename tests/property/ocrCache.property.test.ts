import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { OcrCache } from '@/utils/ocrCache';
import type { AreaOfInterest, OcrResult } from '@/types';

/**
 * Feature: v2-scanner-optimization, Property 5: OCR cache returns identical results
 * **Validates: Requirements 2.1**
 *
 * For any document key and area set, if OCR has been previously processed for that
 * exact combination, a subsequent request with the same key and areas SHALL return
 * the cached OcrResult[] without invoking the OCR engine. The returned results must
 * be deeply equal to the originally stored results.
 */

// --- Arbitraries ---

const arbDocumentKey = fc.stringMatching(/^[a-zA-Z0-9\/_.-]{1,30}$/);

const arbAreaOfInterest: fc.Arbitrary<AreaOfInterest> = fc.record({
  id: fc.uuid(),
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
  width: fc.double({ min: 0.01, max: 1, noNaN: true }),
  height: fc.double({ min: 0.01, max: 1, noNaN: true }),
  variableName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/),
  color: fc.stringMatching(/^#[0-9a-f]{6}$/),
});

const arbOcrResult: fc.Arbitrary<OcrResult> = fc.record({
  variableName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,15}$/),
  extractedText: fc.string({ minLength: 0, maxLength: 200 }),
  confidence: fc.integer({ min: 0, max: 100 }),
  wordCount: fc.integer({ min: 0, max: 50 }),
});

// --- Tests ---

describe('Feature: v2-scanner-optimization, Property 5: OCR cache returns identical results', () => {
  let cache: OcrCache;

  beforeEach(() => {
    cache = new OcrCache();
  });

  it('cache round-trip: set then get returns deeply equal results', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 10 }),
        fc.array(arbOcrResult, { minLength: 1, maxLength: 10 }),
        (documentKey, areas, results) => {
          const key = cache.generateKey(documentKey, areas);
          cache.set(key, results);
          const cached = cache.get(key);

          expect(cached).not.toBeNull();
          expect(cached).toEqual(results);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('key determinism: same inputs always produce same key', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 10 }),
        (documentKey, areas) => {
          const key1 = cache.generateKey(documentKey, areas);
          const key2 = cache.generateKey(documentKey, areas);

          expect(key1).toBe(key2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('key is order-independent for areas', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        fc.array(arbAreaOfInterest, { minLength: 2, maxLength: 10 }),
        (documentKey, areas) => {
          const shuffled = [...areas].reverse();
          const key1 = cache.generateKey(documentKey, areas);
          const key2 = cache.generateKey(documentKey, shuffled);

          expect(key1).toBe(key2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('different areas produce different keys', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 5 }),
        fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 5 }),
        (documentKey, areas1, areas2) => {
          // Ensure the area sets are actually different by checking serialized sorted form
          const sorted1 = [...areas1].sort((a, b) => a.id.localeCompare(b.id));
          const sorted2 = [...areas2].sort((a, b) => a.id.localeCompare(b.id));
          const serialized1 = JSON.stringify(sorted1);
          const serialized2 = JSON.stringify(sorted2);

          // Only assert different keys when the area sets are genuinely different
          fc.pre(serialized1 !== serialized2);

          const key1 = cache.generateKey(documentKey, areas1);
          const key2 = cache.generateKey(documentKey, areas2);

          expect(key1).not.toBe(key2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalidate removes all entries for a document', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        fc.array(
          fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 5 }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(arbOcrResult, { minLength: 1, maxLength: 5 }),
        (documentKey, areaSets, results) => {
          // Store results for multiple area sets under the same document
          const keys = areaSets.map((areas) => {
            const key = cache.generateKey(documentKey, areas);
            cache.set(key, results);
            return key;
          });

          // Invalidate the document
          cache.invalidate(documentKey);

          // All entries for that document should be null
          for (const key of keys) {
            expect(cache.get(key)).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalidate does not affect other documents', () => {
    fc.assert(
      fc.property(
        arbDocumentKey,
        arbDocumentKey,
        fc.array(arbAreaOfInterest, { minLength: 1, maxLength: 5 }),
        fc.array(arbOcrResult, { minLength: 1, maxLength: 5 }),
        fc.array(arbOcrResult, { minLength: 1, maxLength: 5 }),
        (docKeyA, docKeyB, areas, resultsA, resultsB) => {
          // Ensure document keys are different
          fc.pre(docKeyA !== docKeyB);

          const keyA = cache.generateKey(docKeyA, areas);
          const keyB = cache.generateKey(docKeyB, areas);

          cache.set(keyA, resultsA);
          cache.set(keyB, resultsB);

          // Invalidate doc-A
          cache.invalidate(docKeyA);

          // doc-A should be gone
          expect(cache.get(keyA)).toBeNull();
          // doc-B should still be available
          expect(cache.get(keyB)).toEqual(resultsB);
        }
      ),
      { numRuns: 100 }
    );
  });
});
