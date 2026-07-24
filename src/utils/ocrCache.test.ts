import { describe, it, expect, beforeEach } from 'vitest';
import { OcrCache } from './ocrCache';
import type { AreaOfInterest, OcrResult } from '@/types';

describe('OcrCache', () => {
  let cache: OcrCache;

  const mockAreas: AreaOfInterest[] = [
    { id: 'area-1', x: 0.1, y: 0.2, width: 0.3, height: 0.4, variableName: 'nombre', color: '#ff0000' },
    { id: 'area-2', x: 0.5, y: 0.6, width: 0.2, height: 0.1, variableName: 'edad', color: '#00ff00' },
  ];

  const mockResults: OcrResult[] = [
    { variableName: 'nombre', extractedText: 'Juan Pérez', confidence: 95, wordCount: 2 },
    { variableName: 'edad', extractedText: '25', confidence: 99, wordCount: 1 },
  ];

  beforeEach(() => {
    cache = new OcrCache();
  });

  describe('generateKey', () => {
    it('genera una clave con formato documentKey:hash', () => {
      const key = cache.generateKey('doc-123', mockAreas);
      expect(key).toMatch(/^doc-123:.+$/);
    });

    it('genera la misma clave para las mismas áreas independientemente del orden', () => {
      const areasReversed = [...mockAreas].reverse();
      const key1 = cache.generateKey('doc-123', mockAreas);
      const key2 = cache.generateKey('doc-123', areasReversed);
      expect(key1).toBe(key2);
    });

    it('genera claves diferentes para documentos distintos con mismas áreas', () => {
      const key1 = cache.generateKey('doc-1', mockAreas);
      const key2 = cache.generateKey('doc-2', mockAreas);
      expect(key1).not.toBe(key2);
    });

    it('genera claves diferentes para mismas áreas con diferente contenido', () => {
      const alteredAreas: AreaOfInterest[] = [
        { ...mockAreas[0], width: 0.99 },
        mockAreas[1],
      ];
      const key1 = cache.generateKey('doc-1', mockAreas);
      const key2 = cache.generateKey('doc-1', alteredAreas);
      expect(key1).not.toBe(key2);
    });
  });

  describe('get', () => {
    it('retorna null cuando la clave no existe', () => {
      expect(cache.get('clave-inexistente')).toBeNull();
    });

    it('retorna los resultados almacenados para una clave existente', () => {
      const key = cache.generateKey('doc-1', mockAreas);
      cache.set(key, mockResults);
      expect(cache.get(key)).toEqual(mockResults);
    });
  });

  describe('set', () => {
    it('almacena resultados que pueden ser recuperados con get', () => {
      const key = 'test-key';
      cache.set(key, mockResults);
      expect(cache.get(key)).toEqual(mockResults);
    });

    it('sobrescribe resultados previos para la misma clave', () => {
      const key = 'test-key';
      const newResults: OcrResult[] = [
        { variableName: 'nombre', extractedText: 'María', confidence: 88, wordCount: 1 },
      ];
      cache.set(key, mockResults);
      cache.set(key, newResults);
      expect(cache.get(key)).toEqual(newResults);
    });
  });

  describe('invalidate', () => {
    it('elimina todas las entradas para un documentKey dado', () => {
      const key1 = cache.generateKey('doc-1', mockAreas);
      const key2 = cache.generateKey('doc-1', [mockAreas[0]]);
      const key3 = cache.generateKey('doc-2', mockAreas);

      cache.set(key1, mockResults);
      cache.set(key2, [mockResults[0]]);
      cache.set(key3, mockResults);

      cache.invalidate('doc-1');

      expect(cache.get(key1)).toBeNull();
      expect(cache.get(key2)).toBeNull();
      expect(cache.get(key3)).toEqual(mockResults); // doc-2 intacto
    });

    it('no afecta otras entradas si el documentKey no existe', () => {
      const key = cache.generateKey('doc-1', mockAreas);
      cache.set(key, mockResults);

      cache.invalidate('doc-inexistente');

      expect(cache.get(key)).toEqual(mockResults);
    });
  });

  describe('clear', () => {
    it('elimina todas las entradas del cache', () => {
      const key1 = cache.generateKey('doc-1', mockAreas);
      const key2 = cache.generateKey('doc-2', mockAreas);

      cache.set(key1, mockResults);
      cache.set(key2, mockResults);

      cache.clear();

      expect(cache.get(key1)).toBeNull();
      expect(cache.get(key2)).toBeNull();
    });
  });
});
