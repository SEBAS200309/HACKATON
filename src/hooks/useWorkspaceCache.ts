import { useCallback } from 'react';
import { imageCache } from '@/utils/imageCache';
import { ocrCache } from '@/utils/ocrCache';
import type { AreaOfInterest, TextractBlock, OcrResult, WorkspacePage } from '@/types';

/**
 * Hook que integra las cachés de imágenes y OCR en el flujo del workspace.
 *
 * - `loadPageImage`: Carga la imagen de una página priorizando caché local.
 * - `getCachedOcrResults`: Consulta resultados OCR cacheados para un documento + áreas.
 * - `setCachedOcrResults`: Almacena resultados OCR en caché.
 * - `refilterLocally`: Re-filtra bloques OCR localmente cuando cambia un boundary de área.
 */
export function useWorkspaceCache() {
  /**
   * Carga la imagen de una página del workspace.
   * 1. Si la página ya tiene imageUrl (ObjectURL del flujo de captura), la retorna directamente.
   * 2. Si la imagen está en imageCache, retorna la URL cacheada.
   * 3. Si no, la descarga desde imageUrl/S3 y la almacena en caché.
   */
  const loadPageImage = useCallback(async (page: WorkspacePage): Promise<string> => {
    // Si la página tiene una URL que es un blob/object URL (creada durante captura),
    // usarla directamente — no necesita caché
    if (page.imageUrl && page.imageUrl.startsWith('blob:')) {
      return page.imageUrl;
    }

    // Verificar caché local por s3Key
    if (page.imageS3Key && imageCache.has(page.imageS3Key)) {
      const cachedUrl = imageCache.get(page.imageS3Key);
      if (cachedUrl) {
        return cachedUrl;
      }
    }

    // Si no hay s3Key pero sí imageUrl, retornar directamente (compatibilidad)
    if (!page.imageS3Key && page.imageUrl) {
      return page.imageUrl;
    }

    // Descargar imagen y almacenar en caché
    try {
      const response = await fetch(page.imageUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar imagen: ${response.status}`);
      }
      const blob = await response.blob();
      const cachedUrl = imageCache.set(page.imageS3Key, blob);
      return cachedUrl;
    } catch (error) {
      // Fallback: retornar imageUrl directamente si la descarga falla
      console.error('Error al cargar imagen desde caché:', error);
      return page.imageUrl;
    }
  }, []);

  /**
   * Consulta resultados OCR cacheados para un documento y conjunto de áreas.
   * Retorna los resultados si hay cache hit, o null si no hay datos.
   */
  const getCachedOcrResults = useCallback(
    (documentKey: string, areas: AreaOfInterest[]): OcrResult[] | null => {
      const key = ocrCache.generateKey(documentKey, areas);
      return ocrCache.get(key);
    },
    []
  );

  /**
   * Almacena resultados OCR en caché para un documento y conjunto de áreas.
   */
  const setCachedOcrResults = useCallback(
    (documentKey: string, areas: AreaOfInterest[], results: OcrResult[]): void => {
      const key = ocrCache.generateKey(documentKey, areas);
      ocrCache.set(key, results);
    },
    []
  );

  /**
   * Re-filtra bloques OCR localmente cuando el usuario modifica un boundary de área.
   * Usa la fórmula de overlap de BoundingBox para determinar qué bloques WORD
   * caen dentro del área modificada.
   *
   * Fórmula de overlap:
   *   block.left < area.x + area.width AND
   *   block.left + block.width > area.x AND
   *   block.top < area.y + area.height AND
   *   block.top + block.height > area.y
   *
   * Solo incluye bloques de tipo WORD.
   * Retorna el texto concatenado de los bloques filtrados.
   */
  const refilterLocally = useCallback(
    (fullOcrResults: TextractBlock[], area: AreaOfInterest): string => {
      const areaRight = area.x + area.width;
      const areaBottom = area.y + area.height;

      const filteredBlocks = fullOcrResults.filter((block) => {
        // Solo incluir bloques WORD
        if (block.blockType !== 'WORD') {
          return false;
        }

        const { left, top, width, height } = block.boundingBox;
        const blockRight = left + width;
        const blockBottom = top + height;

        // Fórmula de overlap: verificar que el bloque intersecta con el área
        return (
          left < areaRight &&
          blockRight > area.x &&
          top < areaBottom &&
          blockBottom > area.y
        );
      });

      // Ordenar en reading order: top-to-bottom, left-to-right
      filteredBlocks.sort((a, b) => {
        const rowDiff = a.boundingBox.top - b.boundingBox.top;
        // Si están en la misma línea (diferencia vertical < 1% del alto del bloque)
        if (Math.abs(rowDiff) < 0.01) {
          return a.boundingBox.left - b.boundingBox.left;
        }
        return rowDiff;
      });

      // Concatenar texto de todos los bloques filtrados
      return filteredBlocks
        .map((block) => block.text ?? '')
        .filter((text) => text.length > 0)
        .join(' ');
    },
    []
  );

  return {
    loadPageImage,
    getCachedOcrResults,
    setCachedOcrResults,
    refilterLocally,
  };
}
