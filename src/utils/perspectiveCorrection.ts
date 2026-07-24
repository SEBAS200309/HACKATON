/**
 * Corrección de perspectiva para documentos escaneados.
 * Detecta bordes del documento usando gradientes de Sobel + Hough transform simplificado
 * y aplica transformación de perspectiva 4-point usando Canvas.
 */

import type { Point } from '@/types';

export interface PerspectiveCorrectionResult {
  correctedCanvas: HTMLCanvasElement;
  correctedBlob: Blob;
  transformMatrix: number[];
}

// ─── Detección de bordes ──────────────────────────────────────────────────────

/**
 * Detecta las 4 esquinas del documento usando gradientes de Sobel + Hough transform simplificado.
 * Retorna null si no se detectan bordes confiables (fallback a esquinas de imagen).
 *
 * @param imageData - ImageData del canvas fuente
 * @returns Array de 4 puntos [TL, TR, BR, BL] o null si la detección falla
 */
export function detectDocumentCorners(imageData: ImageData): Point[] | null {
  const { width, height, data } = imageData;

  // Paso 1: Convertir a escala de grises
  const gray = toGrayscale(data, width, height);

  // Paso 2: Aplicar filtro Gaussiano para reducir ruido
  const blurred = gaussianBlur(gray, width, height);

  // Paso 3: Aplicar operador Sobel para detectar bordes
  const edges = sobelEdgeDetection(blurred, width, height);

  // Paso 4: Umbralizar bordes
  const threshold = computeOtsuThreshold(edges, width, height);
  const binaryEdges = thresholdEdges(edges, width, height, threshold);

  // Paso 5: Hough transform simplificado para detectar líneas
  const lines = simplifiedHoughTransform(binaryEdges, width, height);

  // Paso 6: Encontrar intersecciones que forman un cuadrilátero
  const corners = findQuadrilateralCorners(lines, width, height);

  if (!corners) {
    return null;
  }

  return corners;
}

// ─── Transformación de perspectiva ────────────────────────────────────────────

/**
 * Aplica transformación de perspectiva 4-point al canvas fuente.
 * Mapea el cuadrilátero definido por corners a un rectángulo de outputWidth x outputHeight.
 *
 * @param sourceCanvas - Canvas con la imagen fuente
 * @param corners - 4 esquinas [TL, TR, BR, BL] del documento detectado
 * @param outputWidth - Ancho del rectángulo de salida
 * @param outputHeight - Alto del rectángulo de salida
 * @returns Resultado con canvas corregido, blob y matriz de transformación
 */
export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number
): PerspectiveCorrectionResult {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const outputCtx = outputCanvas.getContext('2d')!;
  const outputImageData = outputCtx.createImageData(outputWidth, outputHeight);

  const sourceCtx = sourceCanvas.getContext('2d')!;
  const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  // Calcular la matriz de transformación de perspectiva inversa
  // Mapea coordenadas del rectángulo destino al cuadrilátero fuente
  const [tl, tr, br, bl] = corners;
  const transformMatrix = computePerspectiveMatrix(
    // Destino (rectángulo)
    { x: 0, y: 0 }, { x: outputWidth, y: 0 },
    { x: outputWidth, y: outputHeight }, { x: 0, y: outputHeight },
    // Fuente (cuadrilátero)
    tl, tr, br, bl
  );

  // Aplicar transformación con interpolación bilineal
  const srcData = sourceImageData.data;
  const dstData = outputImageData.data;
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Mapear punto (x, y) del destino al fuente usando la matriz
      const srcPoint = applyMatrix(transformMatrix, x, y);

      // Interpolación bilineal
      const pixel = bilinearInterpolate(srcData, srcW, srcH, srcPoint.x, srcPoint.y);

      const dstIdx = (y * outputWidth + x) * 4;
      dstData[dstIdx] = pixel.r;
      dstData[dstIdx + 1] = pixel.g;
      dstData[dstIdx + 2] = pixel.b;
      dstData[dstIdx + 3] = pixel.a;
    }
  }

  outputCtx.putImageData(outputImageData, 0, 0);

  // Generar Blob sincrónicamente usando toDataURL como fallback
  let correctedBlob: Blob;
  const dataUrl = outputCanvas.toDataURL('image/png');
  const binaryStr = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  correctedBlob = new Blob([bytes], { type: 'image/png' });

  return {
    correctedCanvas: outputCanvas,
    correctedBlob,
    transformMatrix,
  };
}

// ─── Funciones auxiliares internas ────────────────────────────────────────────

/** Convierte datos RGBA a escala de grises */
function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  return gray;
}

/** Aplica filtro Gaussiano 5x5 simplificado */
function gaussianBlur(gray: Float32Array, width: number, height: number): Float32Array {
  const kernel = [
    1, 4, 6, 4, 1,
    4, 16, 24, 16, 4,
    6, 24, 36, 24, 6,
    4, 16, 24, 16, 4,
    1, 4, 6, 4, 1,
  ];
  const kernelSum = 256;
  const output = new Float32Array(width * height);

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      let sum = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 2) * 5 + (kx + 2)];
        }
      }
      output[y * width + x] = sum / kernelSum;
    }
  }

  return output;
}

/** Operador Sobel para detección de bordes: retorna magnitud del gradiente */
function sobelEdgeDetection(gray: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Gradiente horizontal (Gx)
      const gx =
        -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)]
        - 2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)]
        - gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

      // Gradiente vertical (Gy)
      const gy =
        -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)]
        + gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return edges;
}

/** Calcula umbral usando método de Otsu simplificado */
function computeOtsuThreshold(edges: Float32Array, width: number, height: number): number {
  // Histograma de 256 bins
  const histogram = new Array(256).fill(0);
  let maxVal = 0;

  for (let i = 0; i < width * height; i++) {
    if (edges[i] > maxVal) maxVal = edges[i];
  }

  if (maxVal === 0) return 128;

  for (let i = 0; i < width * height; i++) {
    const bin = Math.min(255, Math.floor((edges[i] / maxVal) * 255));
    histogram[bin]++;
  }

  const total = width * height;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return (bestThreshold / 255) * maxVal;
}

/** Umbraliza bordes para obtener mapa binario */
function thresholdEdges(
  edges: Float32Array, width: number, height: number, threshold: number
): Uint8Array {
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    binary[i] = edges[i] >= threshold ? 1 : 0;
  }
  return binary;
}

/** Interfaz interna para líneas detectadas en coordenadas polares */
interface HoughLine {
  rho: number;
  theta: number;
}

/**
 * Hough transform simplificado para detectar líneas dominantes.
 * Busca las 4 líneas más fuertes que puedan formar un cuadrilátero.
 */
function simplifiedHoughTransform(
  binaryEdges: Uint8Array, width: number, height: number
): HoughLine[] {
  const diagonal = Math.sqrt(width * width + height * height);
  const rhoMax = Math.ceil(diagonal);
  const thetaSteps = 180;
  const rhoSteps = rhoMax * 2;

  // Acumulador
  const accumulator = new Int32Array(rhoSteps * thetaSteps);

  // Precalcular senos y cosenos
  const cosTable = new Float32Array(thetaSteps);
  const sinTable = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t++) {
    const theta = (t * Math.PI) / thetaSteps;
    cosTable[t] = Math.cos(theta);
    sinTable[t] = Math.sin(theta);
  }

  // Votar en el acumulador (saltar píxeles para rendimiento)
  const step = Math.max(1, Math.floor(Math.min(width, height) / 300));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (binaryEdges[y * width + x] === 0) continue;

      for (let t = 0; t < thetaSteps; t++) {
        const rho = Math.round(x * cosTable[t] + y * sinTable[t]) + rhoMax;
        if (rho >= 0 && rho < rhoSteps) {
          accumulator[rho * thetaSteps + t]++;
        }
      }
    }
  }

  // Encontrar los picos del acumulador
  const peaks: { rho: number; theta: number; votes: number }[] = [];
  const minVotes = Math.max(
    Math.min(width, height) * 0.15 / step,
    10
  );

  for (let r = 0; r < rhoSteps; r++) {
    for (let t = 0; t < thetaSteps; t++) {
      const votes = accumulator[r * thetaSteps + t];
      if (votes >= minVotes) {
        peaks.push({
          rho: r - rhoMax,
          theta: (t * Math.PI) / thetaSteps,
          votes,
        });
      }
    }
  }

  // Ordenar por votos descendente
  peaks.sort((a, b) => b.votes - a.votes);

  // Filtrar líneas similares (non-maximum suppression)
  const rhoThreshold = diagonal * 0.05;
  const thetaThreshold = Math.PI / 18; // 10 grados

  const filteredLines: HoughLine[] = [];
  for (const peak of peaks) {
    let isDuplicate = false;
    for (const existing of filteredLines) {
      if (
        Math.abs(peak.rho - existing.rho) < rhoThreshold &&
        Math.abs(peak.theta - existing.theta) < thetaThreshold
      ) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      filteredLines.push({ rho: peak.rho, theta: peak.theta });
    }
    if (filteredLines.length >= 8) break; // Máximo 8 candidatas
  }

  return filteredLines;
}

/**
 * Encuentra las 4 esquinas del cuadrilátero a partir de las líneas detectadas.
 * Clasifica líneas en horizontales y verticales, luego calcula intersecciones.
 */
function findQuadrilateralCorners(
  lines: HoughLine[], width: number, height: number
): [Point, Point, Point, Point] | null {
  if (lines.length < 4) return null;

  // Clasificar líneas en ~horizontales y ~verticales
  const horizontals: HoughLine[] = [];
  const verticals: HoughLine[] = [];

  for (const line of lines) {
    const angleDeg = (line.theta * 180) / Math.PI;
    if (angleDeg > 45 && angleDeg < 135) {
      horizontals.push(line);
    } else {
      verticals.push(line);
    }
  }

  // Necesitamos al menos 2 horizontales y 2 verticales
  if (horizontals.length < 2 || verticals.length < 2) return null;

  // Tomar las 2 horizontales más separadas
  const hSorted = horizontals.sort((a, b) => {
    const yA = a.rho / Math.sin(a.theta);
    const yB = b.rho / Math.sin(b.theta);
    return yA - yB;
  });
  const topLine = hSorted[0];
  const bottomLine = hSorted[hSorted.length - 1];

  // Tomar las 2 verticales más separadas
  const vSorted = verticals.sort((a, b) => {
    const xA = a.rho / Math.cos(a.theta);
    const xB = b.rho / Math.cos(b.theta);
    return xA - xB;
  });
  const leftLine = vSorted[0];
  const rightLine = vSorted[vSorted.length - 1];

  // Calcular intersecciones
  const tl = lineIntersection(topLine, leftLine);
  const tr = lineIntersection(topLine, rightLine);
  const br = lineIntersection(bottomLine, rightLine);
  const bl = lineIntersection(bottomLine, leftLine);

  if (!tl || !tr || !br || !bl) return null;

  // Validar que las esquinas están dentro de la imagen con margen
  const margin = -0.1; // Permitir un poco fuera del borde
  const allCorners = [tl, tr, br, bl];
  for (const corner of allCorners) {
    if (
      corner.x < width * margin || corner.x > width * (1 - margin) ||
      corner.y < height * margin || corner.y > height * (1 - margin)
    ) {
      return null;
    }
  }

  // Validar que forma un cuadrilátero convexo con área mínima
  const area = quadrilateralArea(tl, tr, br, bl);
  const minArea = width * height * 0.1; // Al menos 10% del área de la imagen
  if (area < minArea) return null;

  if (!isConvexQuadrilateral(tl, tr, br, bl)) return null;

  return [tl, tr, br, bl];
}

/** Calcula la intersección de dos líneas en forma polar (rho, theta) */
function lineIntersection(line1: HoughLine, line2: HoughLine): Point | null {
  const cos1 = Math.cos(line1.theta);
  const sin1 = Math.sin(line1.theta);
  const cos2 = Math.cos(line2.theta);
  const sin2 = Math.sin(line2.theta);

  const det = cos1 * sin2 - cos2 * sin1;
  if (Math.abs(det) < 1e-10) return null; // Líneas paralelas

  const x = (line1.rho * sin2 - line2.rho * sin1) / det;
  const y = (line2.rho * cos1 - line1.rho * cos2) / det;

  return { x, y };
}

/** Calcula el área de un cuadrilátero usando la fórmula del zapato (shoelace) */
function quadrilateralArea(p1: Point, p2: Point, p3: Point, p4: Point): number {
  return 0.5 * Math.abs(
    (p1.x * p2.y - p2.x * p1.y) +
    (p2.x * p3.y - p3.x * p2.y) +
    (p3.x * p4.y - p4.x * p3.y) +
    (p4.x * p1.y - p1.x * p4.y)
  );
}

/** Verifica que 4 puntos forman un cuadrilátero convexo */
function isConvexQuadrilateral(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const points = [p1, p2, p3, p4];
  let sign: number | null = null;

  for (let i = 0; i < 4; i++) {
    const a = points[i];
    const b = points[(i + 1) % 4];
    const c = points[(i + 2) % 4];

    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

    if (sign === null) {
      sign = cross > 0 ? 1 : -1;
    } else {
      if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }

  return true;
}

// ─── Transformación de perspectiva: funciones matemáticas ─────────────────────

/**
 * Calcula la matriz de perspectiva 3x3 que mapea 4 puntos del destino a 4 puntos del fuente.
 * Usa el método DLT (Direct Linear Transform) simplificado.
 * Retorna un array de 9 elementos representando la matriz 3x3.
 */
function computePerspectiveMatrix(
  d0: Point, d1: Point, d2: Point, d3: Point, // puntos destino (rectángulo)
  s0: Point, s1: Point, s2: Point, s3: Point  // puntos fuente (cuadrilátero)
): number[] {
  // Resolver el sistema de ecuaciones para la homografía
  // Mapea: destino -> fuente
  // Usamos el método DLT: resolver Ax = 0 para los 8 parámetros de la homografía

  const srcPts = [s0, s1, s2, s3];
  const dstPts = [d0, d1, d2, d3];

  // Construir la matriz 8x8 del sistema
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = srcPts[i].x;
    const sy = srcPts[i].y;
    const dx = dstPts[i].x;
    const dy = dstPts[i].y;

    A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
    b.push(sx);
    A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
    b.push(sy);
  }

  // Resolver sistema lineal 8x8 con eliminación gaussiana
  const h = solveLinearSystem(A, b);

  if (!h) {
    // Fallback: identidad
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  // Matriz 3x3: [h0, h1, h2; h3, h4, h5; h6, h7, 1]
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Resuelve un sistema lineal Ax = b usando eliminación gaussiana con pivoteo parcial */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Crear matriz aumentada
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Pivoteo parcial
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-10) return null; // Singular

    // Intercambiar filas
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Eliminación
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Sustitución hacia atrás
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = sum / aug[i][i];
  }

  return x;
}

/** Aplica la matriz de perspectiva 3x3 a un punto 2D */
function applyMatrix(matrix: number[], x: number, y: number): Point {
  const w = matrix[6] * x + matrix[7] * y + matrix[8];
  if (Math.abs(w) < 1e-10) {
    return { x: 0, y: 0 };
  }
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / w,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / w,
  };
}

/** Interpolación bilineal para obtener un píxel sub-pixel del array fuente */
function bilinearInterpolate(
  data: Uint8ClampedArray, width: number, height: number, x: number, y: number
): { r: number; g: number; b: number; a: number } {
  // Clamp a los bordes de la imagen
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);

  const xFrac = x - x0;
  const yFrac = y - y0;

  const idx00 = (y0 * width + x0) * 4;
  const idx10 = (y0 * width + x1) * 4;
  const idx01 = (y1 * width + x0) * 4;
  const idx11 = (y1 * width + x1) * 4;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    r: Math.round(lerp(
      lerp(data[idx00], data[idx10], xFrac),
      lerp(data[idx01], data[idx11], xFrac),
      yFrac
    )),
    g: Math.round(lerp(
      lerp(data[idx00 + 1], data[idx10 + 1], xFrac),
      lerp(data[idx01 + 1], data[idx11 + 1], xFrac),
      yFrac
    )),
    b: Math.round(lerp(
      lerp(data[idx00 + 2], data[idx10 + 2], xFrac),
      lerp(data[idx01 + 2], data[idx11 + 2], xFrac),
      yFrac
    )),
    a: Math.round(lerp(
      lerp(data[idx00 + 3], data[idx10 + 3], xFrac),
      lerp(data[idx01 + 3], data[idx11 + 3], xFrac),
      yFrac
    )),
  };
}
