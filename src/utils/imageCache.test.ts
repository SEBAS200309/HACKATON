import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageCache } from './imageCache';

describe('ImageCache', () => {
  let cache: ImageCache;

  // Mock URL.createObjectURL and revokeObjectURL
  const mockCreateObjectURL = vi.fn((blob: Blob) => `blob:mock-${Math.random()}`);
  const mockRevokeObjectURL = vi.fn();

  beforeEach(() => {
    cache = new ImageCache();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
    vi.useFakeTimers();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('set', () => {
    it('almacena un blob y retorna un Object URL', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc1.png', blob);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(url).toBeTruthy();
      expect(typeof url).toBe('string');
    });

    it('revoca la URL anterior si la key ya existe', () => {
      const blob1 = new Blob(['a'], { type: 'image/png' });
      const blob2 = new Blob(['b'], { type: 'image/png' });

      const url1 = cache.set('images/doc.png', blob1);
      cache.set('images/doc.png', blob2);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1);
    });
  });

  describe('get', () => {
    it('retorna la URL para una key válida no expirada', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc.png', blob);

      expect(cache.get('images/doc.png')).toBe(url);
    });

    it('retorna null para una key que no existe', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('retorna null y revoca URL si la entrada expiró', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc.png', blob);

      // Avanzar 31 minutos (más del TTL de 30 min)
      vi.advanceTimersByTime(31 * 60 * 1000);

      expect(cache.get('images/doc.png')).toBeNull();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url);
    });

    it('retorna la URL si está justo dentro del TTL', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc.png', blob);

      // Avanzar 29 minutos (dentro del TTL)
      vi.advanceTimersByTime(29 * 60 * 1000);

      expect(cache.get('images/doc.png')).toBe(url);
    });
  });

  describe('has', () => {
    it('retorna true para una entrada válida', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      cache.set('images/doc.png', blob);

      expect(cache.has('images/doc.png')).toBe(true);
    });

    it('retorna false para una key que no existe', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('retorna false y limpia si la entrada expiró', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc.png', blob);

      vi.advanceTimersByTime(31 * 60 * 1000);

      expect(cache.has('images/doc.png')).toBe(false);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url);
    });
  });

  describe('invalidate', () => {
    it('elimina la entrada y revoca la URL', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = cache.set('images/doc.png', blob);

      cache.invalidate('images/doc.png');

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(url);
      expect(cache.get('images/doc.png')).toBeNull();
    });

    it('no lanza error si la key no existe', () => {
      expect(() => cache.invalidate('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('elimina todas las entradas y revoca todas las URLs', () => {
      const blob1 = new Blob(['a'], { type: 'image/png' });
      const blob2 = new Blob(['b'], { type: 'image/png' });

      cache.set('images/doc1.png', blob1);
      cache.set('images/doc2.png', blob2);

      cache.clear();

      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
      expect(cache.get('images/doc1.png')).toBeNull();
      expect(cache.get('images/doc2.png')).toBeNull();
    });

    it('no lanza error si el caché está vacío', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });
});
