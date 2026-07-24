import type { AreaOfInterest, OcrResult } from '@/types';

/**
 * Genera un hash numérico simple (djb2) a partir de un string.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Cache local de resultados OCR.
 * Evita llamadas repetidas al motor OCR cuando el documento y las áreas no han cambiado.
 */
export class OcrCache {
  private cache: Map<string, OcrResult[]>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Genera una clave determinista basada en documentKey + hash de las áreas serializadas.
   * Las áreas se ordenan por id para garantizar estabilidad independientemente del orden de entrada.
   */
  generateKey(documentKey: string, areas: AreaOfInterest[]): string {
    const sortedAreas = [...areas].sort((a, b) => a.id.localeCompare(b.id));
    const serialized = JSON.stringify(sortedAreas);
    const areasHash = djb2Hash(serialized);
    return `${documentKey}:${areasHash}`;
  }

  /**
   * Obtiene resultados cacheados para una clave dada.
   * Retorna null si no existe en cache.
   */
  get(key: string): OcrResult[] | null {
    const cached = this.cache.get(key);
    return cached ?? null;
  }

  /**
   * Almacena resultados OCR en cache.
   */
  set(key: string, results: OcrResult[]): void {
    this.cache.set(key, results);
  }

  /**
   * Invalida TODAS las entradas de cache asociadas a un documentKey dado.
   * Útil cuando el documento se actualiza y todos sus resultados previos son obsoletos.
   */
  invalidate(documentKey: string): void {
    const prefix = `${documentKey}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpia toda la cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

/** Singleton de OcrCache para uso global en la aplicación */
export const ocrCache = new OcrCache();
