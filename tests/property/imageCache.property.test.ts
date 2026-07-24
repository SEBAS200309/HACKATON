import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ImageCache } from '@/utils/imageCache';

/**
 * Feature: v2-scanner-optimization, Property 3: Image cache round-trip
 * **Validates: Requirements 1.5, 1.6**
 *
 * Para cualquier imagen almacenada en el caché con una s3Key dada,
 * recuperar esa key antes de la expiración TTL DEBE retornar la misma URL (Object URL).
 * Después de la expiración TTL, `get(s3Key)` DEBE retornar `null`.
 */

// --- Mock setup ---

let urlCounter = 0;
const mockCreateObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  urlCounter = 0;
  vi.useFakeTimers();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// --- Arbitraries ---

const s3KeyArb = fc.stringMatching(/^[a-zA-Z0-9/_.\-]{1,50}$/);

const blobArb = fc.uint8Array({ minLength: 1, maxLength: 100 }).map(
  (arr) => new Blob([arr])
);

const timeBeforeTTL = fc.integer({ min: 0, max: 30 * 60 * 1000 - 1 });

// isExpired uses strict '<': cachedAt + ttlMs < Date.now()
// So expiration occurs at cachedAt + ttlMs + 1 (strictly greater)
const timeAfterTTL = fc.integer({ min: 30 * 60 * 1000 + 1, max: 120 * 60 * 1000 });

// --- Property Tests ---

describe('Feature: v2-scanner-optimization, Property 3: Image cache round-trip', () => {
  it('before TTL: get returns the stored URL', () => {
    fc.assert(
      fc.property(s3KeyArb, blobArb, timeBeforeTTL, (s3Key, blob, advanceMs) => {
        const cache = new ImageCache();
        const storedUrl = cache.set(s3Key, blob);

        // Immediately after set, get should return the same URL
        expect(cache.get(s3Key)).toBe(storedUrl);

        // Advance time by a random amount < 30 minutes
        vi.advanceTimersByTime(advanceMs);

        // Still before TTL, get should still return the same URL
        expect(cache.get(s3Key)).toBe(storedUrl);
      }),
      { numRuns: 100 }
    );
  });

  it('after TTL: get returns null', () => {
    fc.assert(
      fc.property(s3KeyArb, blobArb, timeAfterTTL, (s3Key, blob, advanceMs) => {
        const cache = new ImageCache();
        cache.set(s3Key, blob);

        // Advance time beyond TTL
        vi.advanceTimersByTime(advanceMs);

        // After TTL expiration, get should return null
        expect(cache.get(s3Key)).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('multiple keys maintain independence', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(s3KeyArb, { minLength: 1, maxLength: 10 }),
        fc.array(blobArb, { minLength: 1, maxLength: 10 }),
        (keys, blobs) => {
          // Ensure we have matching pairs
          const count = Math.min(keys.length, blobs.length);
          if (count === 0) return;

          const cache = new ImageCache();
          const storedUrls: string[] = [];

          // Store all blobs
          for (let i = 0; i < count; i++) {
            storedUrls.push(cache.set(keys[i], blobs[i]));
          }

          // Each key returns its own URL, not another key's URL
          for (let i = 0; i < count; i++) {
            const retrieved = cache.get(keys[i]);
            expect(retrieved).toBe(storedUrls[i]);

            // Verify it doesn't return another key's URL
            for (let j = 0; j < count; j++) {
              if (i !== j) {
                expect(retrieved).not.toBe(storedUrls[j]);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
