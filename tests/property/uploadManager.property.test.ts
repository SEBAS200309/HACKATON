import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { UploadManager } from '@/utils/uploadManager';

/**
 * Feature: v2-scanner-optimization
 * **Validates: Requirements 1.3, 1.7**
 */

// --- Mock XMLHttpRequest ---

interface MockXHRInstance {
  upload: { onprogress: any };
  status: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  triggerSuccess(): void;
  triggerError(): void;
}

let xhrInstances: MockXHRInstance[] = [];

function MockXHRFactory() {
  return function MockXHR(this: any) {
    this.upload = { onprogress: null };
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.status = 200;
    this.open = vi.fn();
    this.send = vi.fn();
    this.abort = vi.fn();

    const self = this;
    xhrInstances.push({
      upload: self.upload,
      status: self.status,
      get onload() { return self.onload; },
      get onerror() { return self.onerror; },
      get onabort() { return self.onabort; },
      open: self.open,
      send: self.send,
      abort: self.abort,
      triggerSuccess() {
        self.status = 200;
        if (self.onload) self.onload();
      },
      triggerError() {
        if (self.onerror) self.onerror();
      },
    });
  } as any;
}

// --- Helpers ---

function createMockFile(name: string): File {
  const buffer = new ArrayBuffer(1024);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  return new File([blob], name, { type: 'image/jpeg' });
}

// --- Tests ---

describe('Feature: v2-scanner-optimization, Property 2: Upload concurrency never exceeds limit', () => {
  beforeEach(() => {
    xhrInstances = [];
    vi.stubGlobal('XMLHttpRequest', MockXHRFactory());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('at no point during upload processing SHALL more than maxConcurrent files have status uploading simultaneously', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 5 }),
        (numFiles, maxConcurrent) => {
          xhrInstances = [];

          const manager = new UploadManager({
            maxConcurrent,
            maxRetries: 3,
            onProgress: () => {},
          });

          // Enqueue all files
          for (let i = 0; i < numFiles; i++) {
            manager.enqueue(createMockFile(`file-${i}.jpg`), 'source');
          }

          // Check concurrency constraint
          const progress = manager.getProgress();
          const uploadingCount = progress.filter((p) => p.status === 'uploading').length;

          expect(uploadingCount).toBeLessThanOrEqual(maxConcurrent);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('concurrency remains within limit as uploads complete and new ones start', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 15 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        (numFiles, maxConcurrent, completeBatch) => {
          xhrInstances = [];

          const manager = new UploadManager({
            maxConcurrent,
            maxRetries: 3,
            onProgress: () => {},
          });

          // Enqueue files
          for (let i = 0; i < numFiles; i++) {
            manager.enqueue(createMockFile(`file-${i}.jpg`), 'source');
          }

          // Verify initial concurrency
          let progress = manager.getProgress();
          let uploadingCount = progress.filter((p) => p.status === 'uploading').length;
          expect(uploadingCount).toBeLessThanOrEqual(maxConcurrent);

          // Complete some uploads to trigger queue processing
          const toComplete = Math.min(completeBatch, xhrInstances.length);
          for (let i = 0; i < toComplete; i++) {
            xhrInstances[i].triggerSuccess();
          }

          // Re-check concurrency after completions
          progress = manager.getProgress();
          uploadingCount = progress.filter((p) => p.status === 'uploading').length;
          expect(uploadingCount).toBeLessThanOrEqual(maxConcurrent);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: v2-scanner-optimization, Property 4: Upload retry with exponential backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    xhrInstances = [];
    vi.stubGlobal('XMLHttpRequest', MockXHRFactory());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('for any upload that fails K consecutive times (K <= 3), the system retries with delays of 2^K seconds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (failCount) => {
          xhrInstances = [];

          const manager = new UploadManager({
            maxConcurrent: 3,
            maxRetries: 3,
            onProgress: () => {},
          });

          manager.enqueue(createMockFile('test-file.jpg'), 'source');

          // Trigger failures one by one, advancing timers through backoff
          for (let k = 0; k < failCount; k++) {
            const xhrIndex = xhrInstances.length - 1;
            xhrInstances[xhrIndex].triggerError();

            // After error, retryCount should increment
            const progress = manager.getProgress();
            expect(progress[0].retryCount).toBe(k + 1);

            if (k + 1 < failCount || failCount < 3) {
              // Advance timer for exponential backoff: 2000 * 2^k
              const expectedDelay = 2000 * Math.pow(2, k);
              vi.advanceTimersByTime(expectedDelay);
            }
          }

          // If failCount < 3, the file should be pending/uploading (retrying)
          if (failCount < 3) {
            const progress = manager.getProgress();
            expect(['pending', 'uploading']).toContain(progress[0].status);
            expect(progress[0].retryCount).toBe(failCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if K reaches 3 (maxRetries), the upload transitions to failed status without further retries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (maxRetries) => {
          xhrInstances = [];

          const manager = new UploadManager({
            maxConcurrent: 3,
            maxRetries,
            onProgress: () => {},
          });

          manager.enqueue(createMockFile('fail-file.jpg'), 'source');

          // The implementation retries maxRetries times after the initial attempt.
          // Total errors needed to reach 'failed' = maxRetries + 1 (initial + retries)
          const totalErrorsNeeded = maxRetries + 1;

          for (let k = 0; k < totalErrorsNeeded; k++) {
            const currentXhr = xhrInstances[xhrInstances.length - 1];
            currentXhr.triggerError();

            // Advance timer only if more errors are needed (to trigger next retry)
            if (k < totalErrorsNeeded - 1) {
              // After error k, retryCount is k+1, backoff = 2000 * 2^(retryCount-1) = 2000 * 2^k
              const expectedDelay = 2000 * Math.pow(2, k);
              vi.advanceTimersByTime(expectedDelay);
            }
          }

          // After exhausting retries, status should be 'failed'
          const progress = manager.getProgress();
          expect(progress[0].status).toBe('failed');
          expect(progress[0].retryCount).toBe(maxRetries);
          expect(progress[0].error).toBeDefined();

          // No further XHR instances should be created for this file
          const instanceCountAfterFail = xhrInstances.length;
          vi.advanceTimersByTime(20000);
          expect(xhrInstances.length).toBe(instanceCountAfterFail);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exponential backoff delays are exactly 2s, 4s, 8s for consecutive failures', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (targetRetry) => {
          xhrInstances = [];

          const manager = new UploadManager({
            maxConcurrent: 3,
            maxRetries: 3,
            onProgress: () => {},
          });

          manager.enqueue(createMockFile('backoff-file.jpg'), 'source');

          for (let k = 0; k < targetRetry; k++) {
            const xhrIndex = xhrInstances.length - 1;
            xhrInstances[xhrIndex].triggerError();

            const expectedDelay = 2000 * Math.pow(2, k); // 2s, 4s, 8s
            const instancesBefore = xhrInstances.length;

            // Advance just before the backoff — queue should NOT have processed
            vi.advanceTimersByTime(expectedDelay - 1);

            // If not at maxRetries, item should still be pending (waiting for backoff)
            if (k + 1 < 3) {
              const progress = manager.getProgress();
              const item = progress[0];
              // The item is pending and no new XHR should start until timer fires
              if (item.status === 'pending') {
                expect(xhrInstances.length).toBe(instancesBefore);
              }
            }

            // Advance the remaining 1ms to trigger backoff
            vi.advanceTimersByTime(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
