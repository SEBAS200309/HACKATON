/**
 * ImageCache — Caché de imágenes con Object URLs y TTL configurable.
 *
 * Almacena blobs como Object URLs para evitar descargas repetidas de S3.
 * Invalida automáticamente entradas expiradas al acceder.
 */

interface CacheEntry {
  url: string;         // object URL or data URL
  s3Key: string;
  cachedAt: number;    // timestamp
  ttlMs: number;       // default: 30 * 60 * 1000 (30 min)
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutos

export class ImageCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Retorna la URL cacheada para la s3Key dada, o null si no existe o expiró.
   */
  get(s3Key: string): string | null {
    const entry = this.cache.get(s3Key);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.invalidate(s3Key);
      return null;
    }

    return entry.url;
  }

  /**
   * Almacena un blob en el caché creando un Object URL.
   * Retorna la URL generada.
   */
  set(s3Key: string, blob: Blob): string {
    // Si ya existe una entrada para esta key, revocar la URL anterior
    const existing = this.cache.get(s3Key);
    if (existing) {
      URL.revokeObjectURL(existing.url);
    }

    const url = URL.createObjectURL(blob);
    const entry: CacheEntry = {
      url,
      s3Key,
      cachedAt: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
    };

    this.cache.set(s3Key, entry);
    return url;
  }

  /**
   * Verifica si una s3Key tiene una entrada válida (no expirada) en caché.
   */
  has(s3Key: string): boolean {
    const entry = this.cache.get(s3Key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.invalidate(s3Key);
      return false;
    }

    return true;
  }

  /**
   * Invalida (elimina) una entrada del caché, revocando su Object URL.
   */
  invalidate(s3Key: string): void {
    const entry = this.cache.get(s3Key);
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.cache.delete(s3Key);
    }
  }

  /**
   * Limpia todo el caché, revocando todos los Object URLs.
   */
  clear(): void {
    this.cache.forEach((entry) => {
      URL.revokeObjectURL(entry.url);
    });
    this.cache.clear();
  }

  private isExpired(entry: CacheEntry): boolean {
    return entry.cachedAt + entry.ttlMs < Date.now();
  }
}

export const imageCache = new ImageCache();
