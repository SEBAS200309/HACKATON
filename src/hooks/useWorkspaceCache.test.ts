import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceCache } from './useWorkspaceCache';
import type { TextractBlock, AreaOfInterest } from '@/types';

// Mock de las cachés
vi.mock('@/utils/imageCache', () => ({
  imageCache: {
    has: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/utils/ocrCache', () => ({
  ocrCache: {
    generateKey: vi.fn((docKey: string, _areas: unknown[]) => `${docKey}:mock-hash`),
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('useWorkspaceCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('refilterLocally', () => {
    it('filtra solo bloques WORD que se superponen con el área', () => {
      const { result } = renderHook(() => useWorkspaceCache());

      const blocks: TextractBlock[] = [
        {
          blockType: 'WORD',
          text: 'dentro',
          confidence: 99,
          boundingBox: { left: 0.1, top: 0.1, width: 0.1, height: 0.05 },
        },
        {
          blockType: 'WORD',
          text: 'fuera',
          confidence: 95,
          boundingBox: { left: 0.8, top: 0.8, width: 0.1, height: 0.05 },
        },
        {
          blockType: 'LINE',
          text: 'linea-ignorada',
          confidence: 90,
          boundingBox: { left: 0.1, top: 0.1, width: 0.1, height: 0.05 },
        },
      ];

      const area: AreaOfInterest = {
        id: 'area-1',
        x: 0.05,
        y: 0.05,
        width: 0.3,
        height: 0.2,
        variableName: 'nombre',
        color: '#ff0000',
      };

      const result1 = result.current.refilterLocally(blocks, area);
      expect(result1).toBe('dentro');
    });

    it('retorna string vacío si no hay bloques en el área', () => {
      const { result } = renderHook(() => useWorkspaceCache());

      const blocks: TextractBlock[] = [
        {
          blockType: 'WORD',
          text: 'lejos',
          confidence: 95,
          boundingBox: { left: 0.8, top: 0.8, width: 0.1, height: 0.05 },
        },
      ];

      const area: AreaOfInterest = {
        id: 'area-1',
        x: 0.0,
        y: 0.0,
        width: 0.2,
        height: 0.2,
        variableName: 'test',
        color: '#00ff00',
      };

      const result1 = result.current.refilterLocally(blocks, area);
      expect(result1).toBe('');
    });

    it('ordena bloques en reading order (top-to-bottom, left-to-right)', () => {
      const { result } = renderHook(() => useWorkspaceCache());

      const blocks: TextractBlock[] = [
        {
          blockType: 'WORD',
          text: 'segunda',
          confidence: 95,
          boundingBox: { left: 0.3, top: 0.1, width: 0.1, height: 0.03 },
        },
        {
          blockType: 'WORD',
          text: 'primera',
          confidence: 95,
          boundingBox: { left: 0.1, top: 0.1, width: 0.1, height: 0.03 },
        },
        {
          blockType: 'WORD',
          text: 'tercera',
          confidence: 95,
          boundingBox: { left: 0.1, top: 0.3, width: 0.1, height: 0.03 },
        },
      ];

      const area: AreaOfInterest = {
        id: 'area-1',
        x: 0.0,
        y: 0.0,
        width: 1.0,
        height: 1.0,
        variableName: 'all',
        color: '#0000ff',
      };

      const result1 = result.current.refilterLocally(blocks, area);
      expect(result1).toBe('primera segunda tercera');
    });

    it('incluye bloques parcialmente superpuestos con el área', () => {
      const { result } = renderHook(() => useWorkspaceCache());

      // Bloque que se superpone parcialmente (solo una parte dentro del área)
      const blocks: TextractBlock[] = [
        {
          blockType: 'WORD',
          text: 'parcial',
          confidence: 90,
          boundingBox: { left: 0.15, top: 0.15, width: 0.2, height: 0.1 },
        },
      ];

      // Área que solo cubre la primera parte del bloque
      const area: AreaOfInterest = {
        id: 'area-1',
        x: 0.0,
        y: 0.0,
        width: 0.2,
        height: 0.2,
        variableName: 'test',
        color: '#ff00ff',
      };

      const result1 = result.current.refilterLocally(blocks, area);
      expect(result1).toBe('parcial');
    });
  });

  describe('getCachedOcrResults', () => {
    it('retorna resultados cacheados cuando existen', async () => {
      const { ocrCache } = await import('@/utils/ocrCache');
      const mockResults = [
        { variableName: 'nombre', extractedText: 'Juan', confidence: 95, wordCount: 1 },
      ];
      vi.mocked(ocrCache.get).mockReturnValue(mockResults);

      const { result } = renderHook(() => useWorkspaceCache());

      const areas: AreaOfInterest[] = [
        { id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'nombre', color: '#f00' },
      ];

      const cached = result.current.getCachedOcrResults('doc-key', areas);
      expect(cached).toEqual(mockResults);
      expect(ocrCache.generateKey).toHaveBeenCalledWith('doc-key', areas);
    });

    it('retorna null cuando no hay cache hit', async () => {
      const { ocrCache } = await import('@/utils/ocrCache');
      vi.mocked(ocrCache.get).mockReturnValue(null);

      const { result } = renderHook(() => useWorkspaceCache());

      const cached = result.current.getCachedOcrResults('doc-key', []);
      expect(cached).toBeNull();
    });
  });

  describe('setCachedOcrResults', () => {
    it('almacena resultados en el ocrCache', async () => {
      const { ocrCache } = await import('@/utils/ocrCache');

      const { result } = renderHook(() => useWorkspaceCache());

      const areas: AreaOfInterest[] = [
        { id: '1', x: 0, y: 0, width: 0.5, height: 0.5, variableName: 'nombre', color: '#f00' },
      ];
      const results = [
        { variableName: 'nombre', extractedText: 'Juan', confidence: 95, wordCount: 1 },
      ];

      result.current.setCachedOcrResults('doc-key', areas, results);

      expect(ocrCache.generateKey).toHaveBeenCalledWith('doc-key', areas);
      expect(ocrCache.set).toHaveBeenCalledWith('doc-key:mock-hash', results);
    });
  });
});
