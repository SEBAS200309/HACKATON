import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useAppStore } from '@/store/useAppStore';
import type { WorkspaceZone, WorkspacePage, TemplateMetadata } from '@/types';

/**
 * Feature: v2-scanner-optimization, Property 12: Workspace state persistence round-trip
 * Feature: v2-scanner-optimization, Property 13: Page list maintains sequential numbering
 * Feature: v2-scanner-optimization, Property 14: Zone propagation preserves positions
 * Feature: v2-scanner-optimization, Property 18: Photo retake preserves zone definitions
 *
 * **Validates: Requirements 5.4, 5.5, 6.5, 6.6, 6.7, 7.3, 9.1**
 */

// ─── Arbitrary Generators ─────────────────────────────────────────────────────

const arbColor = fc.stringMatching(/^#[0-9a-f]{6}$/);

const arbWorkspaceZone = (): fc.Arbitrary<WorkspaceZone> =>
  fc.record({
    id: fc.uuid(),
    x: fc.double({ min: 0, max: 1, noNaN: true }),
    y: fc.double({ min: 0, max: 1, noNaN: true }),
    width: fc.double({ min: 0.01, max: 1, noNaN: true }),
    height: fc.double({ min: 0.01, max: 1, noNaN: true }),
    variableName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/),
    color: arbColor,
  });

const arbWorkspacePage = (): fc.Arbitrary<Omit<WorkspacePage, 'pageNumber'>> =>
  fc.record({
    id: fc.uuid(),
    imageS3Key: fc.stringMatching(/^sources\/[a-zA-Z0-9]{8}\.(png|jpg)$/),
    imageUrl: fc.webUrl(),
    orientation: fc.constantFrom('portrait', 'landscape') as fc.Arbitrary<'portrait' | 'landscape'>,
    zones: fc.array(arbWorkspaceZone(), { minLength: 0, maxLength: 5 }),
    record: fc.dictionary(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,9}$/),
      fc.string({ minLength: 0, maxLength: 50 })
    ),
    ocrProcessed: fc.boolean(),
    status: fc.constantFrom('pending', 'processing', 'completed', 'error') as fc.Arbitrary<'pending' | 'processing' | 'completed' | 'error'>,
  });

const arbTemplateMetadata = (): fc.Arbitrary<TemplateMetadata> =>
  fc.record({
    id: fc.uuid(),
    type: fc.constantFrom('word', 'xlsx') as fc.Arbitrary<'word' | 'xlsx'>,
    fileName: fc.stringMatching(/^[a-zA-Z0-9_]{1,20}\.(docx|xlsx)$/),
    s3Key: fc.stringMatching(/^templates\/(word|xlsx)\/[a-zA-Z0-9]{8}\.(docx|xlsx)$/),
    fileSize: fc.integer({ min: 1024, max: 10_000_000 }),
    placeholders: fc.array(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,14}$/),
      { minLength: 1, maxLength: 5 }
    ),
    uploadDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31'), noInvalidDate: true }).map(
      (d) => d.toISOString()
    ),
  });

// ─── Helper: Reset store to initial state ─────────────────────────────────────

function resetStore(): void {
  useAppStore.setState({
    workspaceActive: false,
    activeTemplate: null,
    activeXlsxTemplate: null,
    pages: [],
    currentPageId: null,
    availableVariables: [],
    batchProgress: null,
    generatedFiles: [],
  });
  try {
    localStorage.clear();
  } catch {
    // Silently fail in case localStorage is not available
  }
}

// ─── Property 12: Workspace state persistence round-trip ──────────────────────

describe('Feature: v2-scanner-optimization, Property 12: Workspace state persistence round-trip', () => {
  beforeEach(() => {
    resetStore();
  });

  it('serializing to localStorage and deserializing SHALL produce a state deeply equal to the original', () => {
    fc.assert(
      fc.property(
        arbTemplateMetadata(),
        fc.array(arbWorkspacePage(), { minLength: 1, maxLength: 5 }),
        (template, rawPages) => {
          resetStore();

          // Set up workspace with pages (manually assign pageNumbers)
          const pages: WorkspacePage[] = rawPages.map((p, i) => ({
            ...p,
            pageNumber: i + 1,
          }));

          useAppStore.setState({
            workspaceActive: true,
            activeTemplate: template,
            activeXlsxTemplate: null,
            pages,
            currentPageId: pages[0].id,
            availableVariables: template.placeholders.map((name) => ({
              name,
              source: 'word' as const,
              assigned: false,
            })),
            generatedFiles: [],
          });

          // Persist to localStorage
          useAppStore.getState().persistToLocalStorage();

          // Reset the store completely
          useAppStore.setState({
            workspaceActive: false,
            activeTemplate: null,
            activeXlsxTemplate: null,
            pages: [],
            currentPageId: null,
            availableVariables: [],
            generatedFiles: [],
          });

          // Restore from localStorage
          const restored = useAppStore.getState().restoreFromLocalStorage();
          expect(restored).toBe(true);

          // Verify restored state matches original
          const state = useAppStore.getState();
          expect(state.workspaceActive).toBe(true);
          expect(state.activeTemplate).toEqual(template);
          expect(state.pages).toEqual(pages);
          expect(state.currentPageId).toBe(pages[0].id);
          expect(state.availableVariables).toEqual(
            template.placeholders.map((name) => ({
              name,
              source: 'word',
              assigned: false,
            }))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('restoreFromLocalStorage returns false when no data is persisted', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        resetStore();
        localStorage.clear();

        const restored = useAppStore.getState().restoreFromLocalStorage();
        expect(restored).toBe(false);
      }),
      { numRuns: 10 }
    );
  });
});

// ─── Property 13: Page list maintains sequential numbering ────────────────────

describe('Feature: v2-scanner-optimization, Property 13: Page list maintains sequential numbering', () => {
  beforeEach(() => {
    resetStore();
  });

  it('after any sequence of page additions, page numbers form 1..N', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkspacePage(), { minLength: 1, maxLength: 10 }),
        (rawPages) => {
          resetStore();

          // Initialize workspace with a template so addPage works
          useAppStore.setState({
            workspaceActive: true,
            activeTemplate: {
              id: 'tmpl-1',
              type: 'word',
              fileName: 'test.docx',
              s3Key: 'templates/word/test.docx',
              fileSize: 1024,
              placeholders: ['nombre'],
              uploadDate: '2024-01-01T00:00:00.000Z',
            },
            pages: [],
            currentPageId: null,
            availableVariables: [],
          });

          // Add pages one by one
          for (const page of rawPages) {
            useAppStore.getState().addPage(page);
          }

          const pages = useAppStore.getState().pages;
          expect(pages.length).toBe(rawPages.length);

          // Verify sequential numbering: 1, 2, 3, ..., N
          for (let i = 0; i < pages.length; i++) {
            expect(pages[i].pageNumber).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after removals, remaining pages maintain sequential numbering', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkspacePage(), { minLength: 2, maxLength: 8 }),
        fc.integer({ min: 0, max: 7 }),
        (rawPages, removeIdx) => {
          resetStore();

          useAppStore.setState({
            workspaceActive: true,
            activeTemplate: {
              id: 'tmpl-1',
              type: 'word',
              fileName: 'test.docx',
              s3Key: 'templates/word/test.docx',
              fileSize: 1024,
              placeholders: ['nombre'],
              uploadDate: '2024-01-01T00:00:00.000Z',
            },
            pages: [],
            currentPageId: null,
            availableVariables: [],
          });

          // Add all pages
          for (const page of rawPages) {
            useAppStore.getState().addPage(page);
          }

          // Remove one page (bounded to valid index)
          const pages = useAppStore.getState().pages;
          const validIdx = removeIdx % pages.length;
          const pageToRemove = pages[validIdx];

          useAppStore.getState().removePage(pageToRemove.id);

          // Verify sequential numbering after removal
          const remaining = useAppStore.getState().pages;
          expect(remaining.length).toBe(rawPages.length - 1);

          for (let i = 0; i < remaining.length; i++) {
            expect(remaining[i].pageNumber).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after reorder, pages maintain sequential numbering', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkspacePage(), { minLength: 2, maxLength: 8 }),
        fc.integer({ min: 0, max: 7 }),
        fc.integer({ min: 0, max: 7 }),
        (rawPages, fromIdx, toIdx) => {
          resetStore();

          useAppStore.setState({
            workspaceActive: true,
            activeTemplate: {
              id: 'tmpl-1',
              type: 'word',
              fileName: 'test.docx',
              s3Key: 'templates/word/test.docx',
              fileSize: 1024,
              placeholders: ['nombre'],
              uploadDate: '2024-01-01T00:00:00.000Z',
            },
            pages: [],
            currentPageId: null,
            availableVariables: [],
          });

          // Add all pages
          for (const page of rawPages) {
            useAppStore.getState().addPage(page);
          }

          // Reorder with bounded indices
          const pageCount = useAppStore.getState().pages.length;
          const validFrom = fromIdx % pageCount;
          const validTo = toIdx % pageCount;

          useAppStore.getState().reorderPages(validFrom, validTo);

          // Verify sequential numbering after reorder
          const reordered = useAppStore.getState().pages;
          expect(reordered.length).toBe(rawPages.length);

          for (let i = 0; i < reordered.length; i++) {
            expect(reordered[i].pageNumber).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 14: Zone propagation preserves positions ────────────────────────

describe('Feature: v2-scanner-optimization, Property 14: Zone propagation preserves positions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('propagating zones to target pages produces zones with identical position and variable values', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkspaceZone(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 2, max: 6 }),
        (sourceZones, targetPageCount) => {
          resetStore();

          // Create source page with zones and target pages without zones
          const sourcePageId = 'source-page-id';
          const pages: WorkspacePage[] = [
            {
              id: sourcePageId,
              pageNumber: 1,
              imageS3Key: 'sources/source.png',
              imageUrl: 'https://example.com/source.png',
              orientation: 'portrait',
              zones: sourceZones,
              record: {},
              ocrProcessed: false,
              status: 'pending',
            },
            ...Array.from({ length: targetPageCount }, (_, i) => ({
              id: `target-page-${i}`,
              pageNumber: i + 2,
              imageS3Key: `sources/target${i}.png`,
              imageUrl: `https://example.com/target${i}.png`,
              orientation: 'portrait' as const,
              zones: [] as WorkspaceZone[],
              record: {},
              ocrProcessed: false,
              status: 'pending' as const,
            })),
          ];

          useAppStore.setState({
            workspaceActive: true,
            pages,
            currentPageId: sourcePageId,
          });

          // Propagate zones from source to all
          useAppStore.getState().propagateZones(sourcePageId, true);

          // Verify each target page has identical zone positions
          const updatedPages = useAppStore.getState().pages;

          for (const page of updatedPages) {
            if (page.id === sourcePageId) continue;

            expect(page.zones.length).toBe(sourceZones.length);

            for (let z = 0; z < sourceZones.length; z++) {
              expect(page.zones[z].x).toBe(sourceZones[z].x);
              expect(page.zones[z].y).toBe(sourceZones[z].y);
              expect(page.zones[z].width).toBe(sourceZones[z].width);
              expect(page.zones[z].height).toBe(sourceZones[z].height);
              expect(page.zones[z].variableName).toBe(sourceZones[z].variableName);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('propagation does not mutate the source page zones', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkspaceZone(), { minLength: 1, maxLength: 5 }),
        (sourceZones) => {
          resetStore();

          const sourcePageId = 'source-page-id';
          const pages: WorkspacePage[] = [
            {
              id: sourcePageId,
              pageNumber: 1,
              imageS3Key: 'sources/source.png',
              imageUrl: 'https://example.com/source.png',
              orientation: 'portrait',
              zones: sourceZones,
              record: {},
              ocrProcessed: false,
              status: 'pending',
            },
            {
              id: 'target-page',
              pageNumber: 2,
              imageS3Key: 'sources/target.png',
              imageUrl: 'https://example.com/target.png',
              orientation: 'portrait',
              zones: [],
              record: {},
              ocrProcessed: false,
              status: 'pending',
            },
          ];

          useAppStore.setState({
            workspaceActive: true,
            pages,
            currentPageId: sourcePageId,
          });

          // Take snapshot of source zones before propagation
          const zonesSnapshot = JSON.parse(JSON.stringify(sourceZones));

          useAppStore.getState().propagateZones(sourcePageId, true);

          // Verify source page zones are unchanged
          const sourcePage = useAppStore.getState().pages.find((p) => p.id === sourcePageId)!;
          expect(sourcePage.zones).toEqual(zonesSnapshot);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 18: Photo retake preserves zone definitions ─────────────────────

describe('Feature: v2-scanner-optimization, Property 18: Photo retake preserves zone definitions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('retake preserves all zone definitions while clearing OCR results', () => {
    fc.assert(
      fc.property(
        arbWorkspacePage(),
        fc.array(arbWorkspaceZone(), { minLength: 1, maxLength: 5 }),
        fc.stringMatching(/^sources\/[a-zA-Z0-9]{8}\.png$/),
        fc.webUrl(),
        (rawPage, zones, newImageS3Key, newImageUrl) => {
          resetStore();

          const pageId = rawPage.id;
          const page: WorkspacePage = {
            ...rawPage,
            pageNumber: 1,
            zones,
            ocrProcessed: true,
            status: 'completed',
            record: { nombre: 'Juan', apellido: 'Pérez' },
          };

          useAppStore.setState({
            workspaceActive: true,
            pages: [page],
            currentPageId: pageId,
          });

          // Take a snapshot of zone definitions before retake
          const zonesSnapshot = zones.map((z) => ({
            id: z.id,
            x: z.x,
            y: z.y,
            width: z.width,
            height: z.height,
            variableName: z.variableName,
            color: z.color,
          }));

          // Perform retake
          useAppStore.getState().retakePage(pageId, newImageS3Key, newImageUrl);

          const updatedPage = useAppStore.getState().pages.find((p) => p.id === pageId)!;

          // Zone definitions preserved
          expect(updatedPage.zones.length).toBe(zonesSnapshot.length);
          for (let i = 0; i < zonesSnapshot.length; i++) {
            expect(updatedPage.zones[i].id).toBe(zonesSnapshot[i].id);
            expect(updatedPage.zones[i].x).toBe(zonesSnapshot[i].x);
            expect(updatedPage.zones[i].y).toBe(zonesSnapshot[i].y);
            expect(updatedPage.zones[i].width).toBe(zonesSnapshot[i].width);
            expect(updatedPage.zones[i].height).toBe(zonesSnapshot[i].height);
            expect(updatedPage.zones[i].variableName).toBe(zonesSnapshot[i].variableName);
            expect(updatedPage.zones[i].color).toBe(zonesSnapshot[i].color);
          }

          // OCR results cleared
          expect(updatedPage.ocrProcessed).toBe(false);
          expect(updatedPage.status).toBe('pending');
          expect(updatedPage.record).toEqual({});

          // Image replaced
          expect(updatedPage.imageS3Key).toBe(newImageS3Key);
          expect(updatedPage.imageUrl).toBe(newImageUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('retake does not affect other pages in the workspace', () => {
    fc.assert(
      fc.property(
        arbWorkspacePage(),
        arbWorkspacePage(),
        fc.array(arbWorkspaceZone(), { minLength: 1, maxLength: 3 }),
        fc.stringMatching(/^sources\/[a-zA-Z0-9]{8}\.png$/),
        fc.webUrl(),
        (rawPage1, rawPage2, zones, newImageS3Key, newImageUrl) => {
          resetStore();

          // Ensure different IDs
          const page1Id = 'page-1';
          const page2Id = 'page-2';

          const page1: WorkspacePage = {
            ...rawPage1,
            id: page1Id,
            pageNumber: 1,
            zones,
            ocrProcessed: true,
            status: 'completed',
          };
          const page2: WorkspacePage = {
            ...rawPage2,
            id: page2Id,
            pageNumber: 2,
            zones,
            ocrProcessed: true,
            status: 'completed',
          };

          useAppStore.setState({
            workspaceActive: true,
            pages: [page1, page2],
            currentPageId: page1Id,
          });

          // Snapshot page2 before retake of page1
          const page2Snapshot = JSON.parse(JSON.stringify(page2));

          // Retake page1
          useAppStore.getState().retakePage(page1Id, newImageS3Key, newImageUrl);

          // Verify page2 is unaffected
          const updatedPage2 = useAppStore.getState().pages.find((p) => p.id === page2Id)!;
          expect(updatedPage2.zones).toEqual(page2Snapshot.zones);
          expect(updatedPage2.ocrProcessed).toBe(page2Snapshot.ocrProcessed);
          expect(updatedPage2.status).toBe(page2Snapshot.status);
          expect(updatedPage2.imageS3Key).toBe(page2Snapshot.imageS3Key);
          expect(updatedPage2.imageUrl).toBe(page2Snapshot.imageUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});
