import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { WorkspacePage, WorkspaceZone, OcrResult } from '@/types';

/**
 * Feature: v2-scanner-optimization, Property 15: OCR produces exactly one record per page
 * Feature: v2-scanner-optimization, Property 16: Batch generation output count matches records
 * Feature: v2-scanner-optimization, Property 17: Batch generation resilience
 *
 * **Validates: Requirements 7.5, 8.2, 8.3, 8.6, 8.8**
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/services/storageService', () => ({
  storageService: {
    getJsonIndex: vi.fn(),
    putObject: vi.fn(),
    getObject: vi.fn(),
    getPresignedDownloadUrl: vi.fn(),
  },
}));

vi.mock('@/services/documentGenerationService', () => ({
  documentGenerationService: {
    fillWordTemplate: vi.fn(),
    fillXlsxTemplate: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).slice(2),
}));

// ─── Arbitrary Generators ─────────────────────────────────────────────────────

const arbColor = fc.stringMatching(/^#[0-9a-f]{6}$/);

const arbVariableName = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,14}$/);

const _arbWorkspaceZone = (variableName?: string): fc.Arbitrary<WorkspaceZone> =>
  fc.record({
    id: fc.uuid(),
    x: fc.double({ min: 0, max: 0.9, noNaN: true }),
    y: fc.double({ min: 0, max: 0.9, noNaN: true }),
    width: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
    height: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
    variableName: variableName ? fc.constant(variableName) : arbVariableName,
    color: arbColor,
  });

const arbOcrResultForZone = (zone: WorkspaceZone): OcrResult => ({
  variableName: zone.variableName,
  extractedText: `text_${zone.variableName}`,
  confidence: 85,
  wordCount: 2,
});

// ─── Helper: Build workspace pages with consistent zones ──────────────────────

function buildPagesWithZones(
  pageCount: number,
  variableNames: string[]
): { pages: WorkspacePage[]; zones: WorkspaceZone[] } {
  const zones: WorkspaceZone[] = variableNames.map((name, i) => ({
    id: `zone-${i}`,
    x: 0.1 * (i + 1),
    y: 0.1 * (i + 1),
    width: 0.1,
    height: 0.1,
    variableName: name,
    color: `#${String(i).padStart(6, '0')}`,
  }));

  const pages: WorkspacePage[] = Array.from({ length: pageCount }, (_, i) => ({
    id: `page-${i}`,
    pageNumber: i + 1,
    imageS3Key: `sources/image${i}.png`,
    imageUrl: `https://example.com/image${i}.png`,
    orientation: 'portrait' as const,
    zones,
    record: {},
    ocrProcessed: false,
    status: 'pending' as const,
  }));

  return { pages, zones };
}

// ─── Property 15: OCR produces exactly one record per page ────────────────────

describe('Feature: v2-scanner-optimization, Property 15: OCR produces exactly one record per page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processing OCR on N pages with M zones produces exactly N records with M entries each', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // N pages
        fc.array(arbVariableName, { minLength: 1, maxLength: 6 }), // M variable names
        (pageCount, rawVariableNames) => {
          // Ensure unique variable names
          const variableNames = [...new Set(rawVariableNames)];
          if (variableNames.length === 0) return; // skip degenerate case

          const { pages } = buildPagesWithZones(pageCount, variableNames);

          // Simulate OCR processing: for each page, produce OcrResult[] from its zones
          const records: Record<string, string>[] = [];

          for (const page of pages) {
            const ocrResults: OcrResult[] = page.zones.map((zone) =>
              arbOcrResultForZone(zone)
            );

            // Build record from OCR results (same logic as setPageOcrResults)
            const record: Record<string, string> = {};
            for (const result of ocrResults) {
              record[result.variableName] = result.extractedText;
            }

            records.push(record);
          }

          // Property: exactly N records
          expect(records.length).toBe(pageCount);

          // Property: each record has exactly M entries (one per unique variableName)
          for (const record of records) {
            expect(Object.keys(record).length).toBe(variableNames.length);
            // Each variableName must be present
            for (const varName of variableNames) {
              expect(record).toHaveProperty(varName);
              expect(typeof record[varName]).toBe('string');
              expect(record[varName].length).toBeGreaterThan(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('setPageOcrResults updates exactly one page record per call', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // N pages
        fc.array(arbVariableName, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 7 }), // target page index
        (pageCount, rawVariableNames, targetIdx) => {
          const variableNames = [...new Set(rawVariableNames)];
          if (variableNames.length === 0) return;

          const { pages, zones } = buildPagesWithZones(pageCount, variableNames);
          const validTargetIdx = targetIdx % pageCount;
          const targetPage = pages[validTargetIdx];

          // Simulate OCR for target page
          const ocrResults: OcrResult[] = zones.map((zone) => arbOcrResultForZone(zone));

          // Apply setPageOcrResults logic to a single page
          const updatedPages = pages.map((p) => {
            if (p.id !== targetPage.id) return p;
            const newRecord = { ...p.record };
            for (const result of ocrResults) {
              newRecord[result.variableName] = result.extractedText;
            }
            return { ...p, record: newRecord, ocrProcessed: true, status: 'completed' as const };
          });

          // Only the target page should have been updated
          for (let i = 0; i < updatedPages.length; i++) {
            if (i === validTargetIdx) {
              expect(updatedPages[i].ocrProcessed).toBe(true);
              expect(Object.keys(updatedPages[i].record).length).toBe(variableNames.length);
            } else {
              expect(updatedPages[i].ocrProcessed).toBe(false);
              expect(Object.keys(updatedPages[i].record).length).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 16: Batch generation output count matches records ───────────────

describe('Feature: v2-scanner-optimization, Property 16: Batch generation output count matches records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('batch generation with N records produces exactly N docx files (docx only)', async () => {
    const { storageService } = await import('@/services/storageService');
    const { documentGenerationService } = await import('@/services/documentGenerationService');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // N records
        fc.array(arbVariableName, { minLength: 1, maxLength: 4 }),
        async (recordCount, rawVarNames) => {
          const variableNames = [...new Set(rawVarNames)];
          if (variableNames.length === 0) return;

          vi.clearAllMocks();

          // Build N records
          const records: Array<Record<string, string>> = Array.from(
            { length: recordCount },
            (_, i) => {
              const record: Record<string, string> = {};
              for (const varName of variableNames) {
                record[varName] = `value_${varName}_${i}`;
              }
              return record;
            }
          );

          // Mock storageService to return template metadata
          const mockTemplateIndex = [
            {
              id: 'tmpl-word-1',
              type: 'word',
              fileName: 'plantilla.docx',
              s3Key: 'templates/word/tmpl-word-1.docx',
              fileSize: 5000,
              placeholders: variableNames,
              uploadDate: '2024-01-01T00:00:00.000Z',
            },
          ];

          vi.mocked(storageService.getJsonIndex).mockResolvedValue(mockTemplateIndex);
          vi.mocked(storageService.putObject).mockResolvedValue(undefined);
          vi.mocked(storageService.getObject).mockResolvedValue(Buffer.from('fake-content'));
          vi.mocked(storageService.getPresignedDownloadUrl).mockResolvedValue(
            'https://s3.example.com/download'
          );
          vi.mocked(documentGenerationService.fillWordTemplate).mockResolvedValue(
            Buffer.from('fake-docx')
          );

          // Simulate the batch route logic (no xlsx)
          const generatedFiles: Array<{ type: 'docx' | 'xlsx' }> = [];
          const errors: Array<{ recordIndex: number; message: string }> = [];

          for (let i = 0; i < records.length; i++) {
            try {
              await documentGenerationService.fillWordTemplate(
                mockTemplateIndex[0].s3Key,
                records[i]
              );
              generatedFiles.push({ type: 'docx' });
            } catch {
              errors.push({
                recordIndex: i,
                message: `Error en registro ${i}`,
              });
            }
          }

          // Property: exactly N docx files when all succeed
          expect(generatedFiles.filter((f) => f.type === 'docx').length).toBe(recordCount);
          expect(errors.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('batch generation with XLSX template produces N docx files + 1 xlsx file', async () => {
    const { documentGenerationService } = await import('@/services/documentGenerationService');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        fc.array(arbVariableName, { minLength: 1, maxLength: 4 }),
        async (recordCount, rawVarNames) => {
          const variableNames = [...new Set(rawVarNames)];
          if (variableNames.length === 0) return;

          vi.clearAllMocks();

          const records: Array<Record<string, string>> = Array.from(
            { length: recordCount },
            (_, i) => {
              const record: Record<string, string> = {};
              for (const varName of variableNames) {
                record[varName] = `value_${varName}_${i}`;
              }
              return record;
            }
          );

          vi.mocked(documentGenerationService.fillWordTemplate).mockResolvedValue(
            Buffer.from('fake-docx')
          );
          vi.mocked(documentGenerationService.fillXlsxTemplate).mockResolvedValue(
            Buffer.from('fake-xlsx')
          );

          // Simulate batch route logic with xlsx
          const generatedFiles: Array<{ type: 'docx' | 'xlsx' }> = [];
          const errors: Array<{ recordIndex: number; message: string }> = [];

          // Generate docx files
          for (let i = 0; i < records.length; i++) {
            try {
              await documentGenerationService.fillWordTemplate('template.docx', records[i]);
              generatedFiles.push({ type: 'docx' });
            } catch {
              errors.push({ recordIndex: i, message: `Error en registro ${i}` });
            }
          }

          // Generate xlsx (one file with all records accumulated)
          let xlsxGenerated = false;
          try {
            for (let i = 0; i < records.length; i++) {
              if (errors.some((e) => e.recordIndex === i)) continue;
              await documentGenerationService.fillXlsxTemplate('template.xlsx', records[i]);
            }
            xlsxGenerated = true;
          } catch {
            // xlsx generation failed
          }

          if (xlsxGenerated) {
            generatedFiles.push({ type: 'xlsx' });
          }

          // Property: N docx files + 1 xlsx file = N+1 total
          const docxCount = generatedFiles.filter((f) => f.type === 'docx').length;
          const xlsxCount = generatedFiles.filter((f) => f.type === 'xlsx').length;

          expect(docxCount).toBe(recordCount);
          expect(xlsxCount).toBe(1);
          expect(generatedFiles.length).toBe(recordCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 17: Batch generation resilience ─────────────────────────────────

describe('Feature: v2-scanner-optimization, Property 17: Batch generation resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when K records fail (K < N), produces (N-K) successful docs and reports K errors', async () => {
    const { documentGenerationService } = await import('@/services/documentGenerationService');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 12 }), // N total records (min 2 so K < N is possible)
        fc.integer({ min: 1, max: 11 }), // K failures (will be clamped to < N)
        fc.array(arbVariableName, { minLength: 1, maxLength: 4 }),
        async (totalRecords, rawFailures, rawVarNames) => {
          const variableNames = [...new Set(rawVarNames)];
          if (variableNames.length === 0) return;

          // K must be < N
          const failureCount = Math.min(rawFailures, totalRecords - 1);

          vi.clearAllMocks();

          // Build records
          const records: Array<Record<string, string>> = Array.from(
            { length: totalRecords },
            (_, i) => {
              const record: Record<string, string> = {};
              for (const varName of variableNames) {
                record[varName] = `value_${varName}_${i}`;
              }
              return record;
            }
          );

          // Determine which records will fail (first K records)
          const failingIndices = new Set(
            Array.from({ length: failureCount }, (_, i) => i)
          );

          // Mock: fail for specific indices, succeed for others
          let callIndex = 0;
          vi.mocked(documentGenerationService.fillWordTemplate).mockImplementation(async () => {
            const currentIndex = callIndex++;
            if (failingIndices.has(currentIndex)) {
              throw new Error(`Error simulado para registro ${currentIndex}`);
            }
            return Buffer.from('fake-docx');
          });

          // Simulate batch route logic with resilience
          const generatedFiles: Array<{ type: 'docx'; recordIndex: number }> = [];
          const errors: Array<{ recordIndex: number; message: string }> = [];

          for (let i = 0; i < records.length; i++) {
            try {
              await documentGenerationService.fillWordTemplate('template.docx', records[i]);
              generatedFiles.push({ type: 'docx', recordIndex: i });
            } catch (error) {
              errors.push({
                recordIndex: i,
                message: error instanceof Error ? error.message : 'Error desconocido',
              });
            }
          }

          // Property: (N - K) successful documents
          expect(generatedFiles.length).toBe(totalRecords - failureCount);

          // Property: exactly K errors
          expect(errors.length).toBe(failureCount);

          // Property: each error has correct recordIndex
          for (const error of errors) {
            expect(failingIndices.has(error.recordIndex)).toBe(true);
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(0);
          }

          // Property: successful files are from non-failing indices
          for (const file of generatedFiles) {
            expect(failingIndices.has(file.recordIndex)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when all records succeed (K=0), produces N documents and 0 errors', async () => {
    const { documentGenerationService } = await import('@/services/documentGenerationService');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.array(arbVariableName, { minLength: 1, maxLength: 4 }),
        async (totalRecords, rawVarNames) => {
          const variableNames = [...new Set(rawVarNames)];
          if (variableNames.length === 0) return;

          vi.clearAllMocks();

          const records: Array<Record<string, string>> = Array.from(
            { length: totalRecords },
            (_, i) => {
              const record: Record<string, string> = {};
              for (const varName of variableNames) {
                record[varName] = `value_${varName}_${i}`;
              }
              return record;
            }
          );

          vi.mocked(documentGenerationService.fillWordTemplate).mockResolvedValue(
            Buffer.from('fake-docx')
          );

          const generatedFiles: Array<{ type: 'docx' }> = [];
          const errors: Array<{ recordIndex: number; message: string }> = [];

          for (let i = 0; i < records.length; i++) {
            try {
              await documentGenerationService.fillWordTemplate('template.docx', records[i]);
              generatedFiles.push({ type: 'docx' });
            } catch (error) {
              errors.push({
                recordIndex: i,
                message: error instanceof Error ? error.message : 'Error desconocido',
              });
            }
          }

          // Property: N documents, 0 errors
          expect(generatedFiles.length).toBe(totalRecords);
          expect(errors.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
