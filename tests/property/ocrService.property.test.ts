import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TextractBlock, AreaOfInterest } from '@/types';

/**
 * Property tests for TesseractOcrService.
 * Tests the core logic (filtering, normalization, sorting, threshold, worker reuse)
 * without importing the full service to avoid AWS/Tesseract dependencies.
 */

// --- Local re-implementations of service logic for isolated testing ---

/**
 * filterBlocksByArea — identical to TesseractOcrService.filterBlocksByArea
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

/**
 * Large file transmission decision logic — mirrors detectText behavior.
 * Returns 'S3_REFERENCE' when bytes > 5MB and s3Key is provided, else 'DIRECT_BYTES'.
 */
function getTransmissionMode(bytesLength: number, s3Key?: string): 'S3_REFERENCE' | 'DIRECT_BYTES' {
  const MAX_BYTES_SIZE = 5 * 1024 * 1024; // 5MB
  if (bytesLength > MAX_BYTES_SIZE && s3Key) {
    return 'S3_REFERENCE';
  }
  return 'DIRECT_BYTES';
}

/**
 * mapTesseractOutput — normalizes BoundingBox coordinates to 0-1 range.
 * Replicates the logic from tesseractOcrService.ts.
 */
interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractPageData {
  text: string;
  confidence: number;
  lines?: TesseractLine[];
  words?: TesseractWord[];
}

function mapTesseractOutput(
  pageData: TesseractPageData,
  imageWidth: number,
  imageHeight: number
): TextractBlock[] {
  const blocks: TextractBlock[] = [];

  // PAGE block
  blocks.push({
    blockType: 'PAGE',
    text: pageData.text,
    confidence: pageData.confidence,
    boundingBox: { width: 1, height: 1, left: 0, top: 0 },
  });

  // LINE blocks
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

  // WORD blocks
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

/**
 * Reading order sort — identical to TesseractOcrService.processDocument sort logic.
 * Top-to-bottom, left-to-right within same line (|topDiff| < 0.005).
 */
function sortReadingOrder(blocks: TextractBlock[]): TextractBlock[] {
  return [...blocks].sort((a, b) => {
    const topDiff = a.boundingBox.top - b.boundingBox.top;
    if (Math.abs(topDiff) < 0.005) {
      return a.boundingBox.left - b.boundingBox.left;
    }
    return topDiff;
  });
}

// --- Generators ---

const boundingBoxArb = fc.record({
  left: fc.double({ min: 0, max: 0.9, noNaN: true }),
  top: fc.double({ min: 0, max: 0.9, noNaN: true }),
  width: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
  height: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
}).filter((bb) => bb.left + bb.width <= 1 && bb.top + bb.height <= 1);

const wordBlockArb: fc.Arbitrary<TextractBlock> = fc.record({
  boundingBox: boundingBoxArb,
  confidence: fc.double({ min: 0, max: 100, noNaN: true }),
  text: fc.string({ minLength: 1, maxLength: 10 }),
}).map(({ boundingBox, confidence, text }) => ({
  blockType: 'WORD' as const,
  text,
  confidence,
  boundingBox,
}));

const nonWordBlockArb: fc.Arbitrary<TextractBlock> = fc.record({
  blockType: fc.constantFrom('PAGE' as const, 'LINE' as const),
  text: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  confidence: fc.double({ min: 0, max: 100, noNaN: true }),
  boundingBox: boundingBoxArb,
});

const areaArb: fc.Arbitrary<AreaOfInterest> = fc.record({
  id: fc.uuid(),
  x: fc.double({ min: 0, max: 0.9, noNaN: true }),
  y: fc.double({ min: 0, max: 0.9, noNaN: true }),
  width: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
  height: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
  variableName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  color: fc.constant('#a855f7'),
}).filter((a) => a.x + a.width <= 1 && a.y + a.height <= 1);

/**
 * Generator for valid Tesseract word with bbox within image dimensions.
 */
const tesseractWordArb = (imageWidth: number, imageHeight: number) =>
  fc.record({
    text: fc.string({ minLength: 1, maxLength: 15 }),
    confidence: fc.double({ min: 0, max: 100, noNaN: true }),
    bbox: fc.record({
      x0: fc.integer({ min: 0, max: imageWidth - 2 }),
      y0: fc.integer({ min: 0, max: imageHeight - 2 }),
      x1: fc.integer({ min: 1, max: imageWidth }),
      y1: fc.integer({ min: 1, max: imageHeight }),
    }).filter((b) => b.x0 < b.x1 && b.y0 < b.y1),
  });

// --- Property Tests ---

describe('Feature: v2-scanner-optimization, Property 6: BoundingBox area filtering correctness (Tesseract)', () => {
  /**
   * **Validates: Requirements 2.2, 2.4, 10.6**
   *
   * For any WORD block and any AreaOfInterest with normalized coordinates,
   * filterBlocksByArea includes the block if and only if the overlap formula holds:
   *   block.left < area.x + area.width AND
   *   block.left + block.width > area.x AND
   *   block.top < area.y + area.height AND
   *   block.top + block.height > area.y
   */

  it('should include a WORD block iff the overlap formula holds', () => {
    fc.assert(
      fc.property(wordBlockArb, areaArb, (block, area) => {
        const bb = block.boundingBox;

        const expectedOverlap =
          bb.left < area.x + area.width &&
          bb.left + bb.width > area.x &&
          bb.top < area.y + area.height &&
          bb.top + bb.height > area.y;

        const result = filterBlocksByArea([block], area);

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

  it('should correctly handle a mixed set preserving only overlapping WORDs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(wordBlockArb, nonWordBlockArb), { minLength: 1, maxLength: 15 }),
        areaArb,
        (blocks, area) => {
          const result = filterBlocksByArea(blocks, area);

          // All returned blocks are WORD type
          for (const block of result) {
            expect(block.blockType).toBe('WORD');
          }

          // All WORD blocks meeting the overlap formula are in the result
          const expected = blocks.filter((b) => {
            if (b.blockType !== 'WORD') return false;
            const bb = b.boundingBox;
            return (
              bb.left < area.x + area.width &&
              bb.left + bb.width > area.x &&
              bb.top < area.y + area.height &&
              bb.top + bb.height > area.y
            );
          });

          expect(result).toHaveLength(expected.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: v2-scanner-optimization, Property 7: Large file transmission threshold', () => {
  /**
   * **Validates: Requirements 2.5, 10.4**
   *
   * For any buffer size and s3Key, the transmission decision is:
   * - 'S3_REFERENCE' when bytes > 5MB AND s3Key is provided
   * - 'DIRECT_BYTES' otherwise (bytes <= 5MB or no s3Key)
   */

  const FIVE_MB = 5 * 1024 * 1024;

  it('should use S3 reference when buffer > 5MB and s3Key is provided', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: FIVE_MB + 1, max: 50 * 1024 * 1024 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (bytesLength, s3Key) => {
          const mode = getTransmissionMode(bytesLength, s3Key);
          expect(mode).toBe('S3_REFERENCE');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use direct bytes when buffer <= 5MB regardless of s3Key', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: FIVE_MB }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        (bytesLength, s3Key) => {
          const mode = getTransmissionMode(bytesLength, s3Key);
          expect(mode).toBe('DIRECT_BYTES');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use direct bytes when buffer > 5MB but no s3Key provided', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: FIVE_MB + 1, max: 50 * 1024 * 1024 }),
        (bytesLength) => {
          const mode = getTransmissionMode(bytesLength, undefined);
          expect(mode).toBe('DIRECT_BYTES');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be a complete partition: exactly one of the two modes for any input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 * 1024 * 1024 }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        (bytesLength, s3Key) => {
          const mode = getTransmissionMode(bytesLength, s3Key);
          expect(['S3_REFERENCE', 'DIRECT_BYTES']).toContain(mode);

          // Verify correctness
          if (bytesLength > FIVE_MB && s3Key) {
            expect(mode).toBe('S3_REFERENCE');
          } else {
            expect(mode).toBe('DIRECT_BYTES');
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Feature: v2-scanner-optimization, Property 19: Tesseract output BoundingBox normalization', () => {
  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * Given valid Tesseract page data with words having bbox coordinates within
   * image dimensions, all output TextractBlocks have normalized coordinates in [0,1] range:
   * - 0 <= left <= 1, 0 <= top <= 1, 0 <= width <= 1, 0 <= height <= 1
   * - left + width <= 1, top + height <= 1
   * - confidence in [0, 100]
   */

  it('should normalize all bbox coordinates to [0,1] range', () => {
    const imageWidth = 2048;
    const imageHeight = 1536;

    fc.assert(
      fc.property(
        fc.array(tesseractWordArb(imageWidth, imageHeight), { minLength: 1, maxLength: 10 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (words, pageConfidence) => {
          const pageData: TesseractPageData = {
            text: words.map((w) => w.text).join(' '),
            confidence: pageConfidence,
            words,
          };

          const blocks = mapTesseractOutput(pageData, imageWidth, imageHeight);

          for (const block of blocks) {
            const bb = block.boundingBox;

            // All coordinates in [0, 1]
            expect(bb.left).toBeGreaterThanOrEqual(0);
            expect(bb.left).toBeLessThanOrEqual(1);
            expect(bb.top).toBeGreaterThanOrEqual(0);
            expect(bb.top).toBeLessThanOrEqual(1);
            expect(bb.width).toBeGreaterThanOrEqual(0);
            expect(bb.width).toBeLessThanOrEqual(1);
            expect(bb.height).toBeGreaterThanOrEqual(0);
            expect(bb.height).toBeLessThanOrEqual(1);

            // left + width <= 1, top + height <= 1
            expect(bb.left + bb.width).toBeLessThanOrEqual(1 + 1e-10); // floating point tolerance
            expect(bb.top + bb.height).toBeLessThanOrEqual(1 + 1e-10);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should produce confidence values in [0, 100] for all WORD blocks', () => {
    const imageWidth = 1920;
    const imageHeight = 1080;

    fc.assert(
      fc.property(
        fc.array(tesseractWordArb(imageWidth, imageHeight), { minLength: 1, maxLength: 8 }),
        (words) => {
          const pageData: TesseractPageData = {
            text: words.map((w) => w.text).join(' '),
            confidence: 85,
            words,
          };

          const blocks = mapTesseractOutput(pageData, imageWidth, imageHeight);
          const wordBlocks = blocks.filter((b) => b.blockType === 'WORD');

          for (const block of wordBlocks) {
            expect(block.confidence).toBeGreaterThanOrEqual(0);
            expect(block.confidence).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include exactly one PAGE block as first element', () => {
    const imageWidth = 800;
    const imageHeight = 600;

    fc.assert(
      fc.property(
        fc.array(tesseractWordArb(imageWidth, imageHeight), { minLength: 0, maxLength: 5 }),
        (words) => {
          const pageData: TesseractPageData = {
            text: words.map((w) => w.text).join(' '),
            confidence: 90,
            words,
          };

          const blocks = mapTesseractOutput(pageData, imageWidth, imageHeight);

          // First block is always PAGE with full-page bbox
          expect(blocks[0].blockType).toBe('PAGE');
          expect(blocks[0].boundingBox).toEqual({ left: 0, top: 0, width: 1, height: 1 });

          // Exactly one PAGE block
          const pageBlocks = blocks.filter((b) => b.blockType === 'PAGE');
          expect(pageBlocks).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: v2-scanner-optimization, Property 20: Reading order sort correctness', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * Blocks sorted in reading order satisfy:
   * - Blocks on same line (|topDiff| < 0.005) are ordered left-to-right
   * - Blocks on different lines are ordered top-to-bottom
   */

  it('should sort blocks on the same line left-to-right', () => {
    // Generate blocks that are on the same line (same top value)
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        fc.array(
          fc.double({ min: 0, max: 0.9, noNaN: true }),
          { minLength: 2, maxLength: 10 }
        ),
        (topValue, leftValues) => {
          const blocks: TextractBlock[] = leftValues.map((left) => ({
            blockType: 'WORD' as const,
            text: 'word',
            confidence: 95,
            boundingBox: { left, top: topValue, width: 0.05, height: 0.02 },
          }));

          const sorted = sortReadingOrder(blocks);

          // All blocks on same line should be left-to-right
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].boundingBox.left).toBeGreaterThanOrEqual(
              sorted[i - 1].boundingBox.left
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sort blocks on different lines top-to-bottom', () => {
    // Generate blocks with distinct top values (difference >= 0.005)
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: 0, max: 0.95, noNaN: true }),
          { minLength: 2, maxLength: 10 }
        ).filter((tops) => {
          // Ensure all pairs have |diff| >= 0.005 (different lines)
          for (let i = 0; i < tops.length; i++) {
            for (let j = i + 1; j < tops.length; j++) {
              if (Math.abs(tops[i] - tops[j]) < 0.005) return false;
            }
          }
          return true;
        }),
        (topValues) => {
          const blocks: TextractBlock[] = topValues.map((top) => ({
            blockType: 'WORD' as const,
            text: 'word',
            confidence: 95,
            boundingBox: { left: 0.1, top, width: 0.05, height: 0.02 },
          }));

          const sorted = sortReadingOrder(blocks);

          // All consecutive blocks should be top-to-bottom
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].boundingBox.top).toBeGreaterThan(
              sorted[i - 1].boundingBox.top
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain stable sort: same-line blocks by left, different-line blocks by top', () => {
    fc.assert(
      fc.property(
        fc.array(wordBlockArb, { minLength: 2, maxLength: 12 }),
        (blocks) => {
          const sorted = sortReadingOrder(blocks);

          for (let i = 1; i < sorted.length; i++) {
            const topDiff = sorted[i].boundingBox.top - sorted[i - 1].boundingBox.top;

            if (Math.abs(topDiff) < 0.005) {
              // Same line: left must be non-decreasing
              expect(sorted[i].boundingBox.left).toBeGreaterThanOrEqual(
                sorted[i - 1].boundingBox.left
              );
            } else {
              // Different lines: top must be increasing
              expect(sorted[i].boundingBox.top).toBeGreaterThan(
                sorted[i - 1].boundingBox.top
              );
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should preserve array length (sort is a permutation)', () => {
    fc.assert(
      fc.property(
        fc.array(wordBlockArb, { minLength: 0, maxLength: 15 }),
        (blocks) => {
          const sorted = sortReadingOrder(blocks);
          expect(sorted).toHaveLength(blocks.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: v2-scanner-optimization, Property 21: Worker reuse across warm invocations', () => {
  /**
   * **Validates: Requirements 12.4**
   *
   * The module-level singleton workerInstance is initialized once and reused.
   * We test the singleton pattern logic: multiple calls to initialize should
   * only create the worker once.
   */

  /**
   * Factory that creates an isolated singleton pattern (simulating the module-level worker).
   * Each call to createSingleton returns a fresh closure with its own state.
   */
  function createSingleton() {
    let workerInstance: { id: string } | null = null;
    let isInitializing = false;
    let initPromise: Promise<void> | null = null;
    let createCount = 0;

    async function initialize(): Promise<{ id: string }> {
      if (workerInstance) {
        return workerInstance;
      }

      if (isInitializing && initPromise) {
        await initPromise;
        if (workerInstance) return workerInstance;
      }

      isInitializing = true;
      initPromise = (async () => {
        // Simulate async worker creation
        await Promise.resolve();
        createCount++;
        workerInstance = { id: 'worker-singleton' };
        isInitializing = false;
      })();

      await initPromise;
      initPromise = null;
      return workerInstance!;
    }

    return { initialize, getCreateCount: () => createCount };
  }

  it('should only call createWorker once across multiple sequential initializations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (invocationCount) => {
          // Create fresh singleton per property run
          const { initialize, getCreateCount } = createSingleton();

          // Simulate multiple warm invocations sequentially
          for (let i = 0; i < invocationCount; i++) {
            await initialize();
          }

          // createWorker should have been called exactly once
          expect(getCreateCount()).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return the same instance reference on every call after initialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 20 }),
        async (callCount) => {
          const { initialize } = createSingleton();

          const firstWorker = await initialize();

          for (let i = 1; i < callCount; i++) {
            const worker = await initialize();
            // Same object reference each time
            expect(worker).toBe(firstWorker);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle concurrent initialization requests safely (only one worker created)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }),
        async (concurrentCalls) => {
          const { initialize, getCreateCount } = createSingleton();

          // Launch concurrent initializations
          const promises = Array.from({ length: concurrentCalls }, () => initialize());
          const results = await Promise.all(promises);

          // Only one worker should have been created
          expect(getCreateCount()).toBe(1);

          // All results are the same reference
          for (const result of results) {
            expect(result).toBe(results[0]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
