// Domain types for Document Digitization MVP
// This file will be fully populated by task 1.2

export interface AreaOfInterest {
  id: string;
  x: number;        // porcentaje (0–1) relativo al ancho del documento
  y: number;        // porcentaje (0–1) relativo al alto del documento
  width: number;    // porcentaje (0–1)
  height: number;   // porcentaje (0–1)
  variableName: string;
  color: string;    // color único para distinción visual
}

export interface OcrResult {
  variableName: string;
  extractedText: string;
  confidence: number; // 0–100, min(confidence) de todos los WORD blocks en el área
  wordCount: number;
}

export interface TemplateMetadata {
  id: string;
  type: 'word' | 'xlsx';
  fileName: string;
  s3Key: string;
  fileSize: number;
  placeholders: string[];
  uploadDate: string;
}

export interface Variable {
  name: string;
  source: 'word' | 'xlsx' | 'both';
  assigned: boolean;
  /** Si es false, no es obligatorio para generar documentos */
  required: boolean;
  /** Si es true, el valor extraído se copia a todos los registros de la página (multi-record) */
  broadcastToAll: boolean;
}

export interface SegmentationConfig {
  templateId: string;
  configName: string;
  areas: AreaOfInterest[];
  lastModified: string;
}

export interface SegmentationConfigMeta {
  templateId: string;
  configName: string;
  areaCount: number;
  lastModified: string;
}

export interface TemplateIndex {
  templates: TemplateMetadata[];
}

export interface ConfigIndex {
  configurations: SegmentationConfigMeta[];
}

export interface TextractBlock {
  blockType: 'PAGE' | 'LINE' | 'WORD';
  text?: string;
  confidence: number;
  boundingBox: { width: number; height: number; left: number; top: number };
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  sourceDocumentKey: string;
  generatedDocxKey: string;
  generatedXlsxKey?: string;
  variables: Record<string, string>;
  confidenceScores: Record<string, number>;
  createdAt: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ─── Workspace Types ──────────────────────────────────────────────────────────

export interface WorkspacePage {
  id: string;
  pageNumber: number;
  imageS3Key: string;
  imageUrl: string;
  /** Orientación de visualización de la página: vertical u horizontal */
  orientation: 'portrait' | 'landscape';
  zones: WorkspaceZone[];
  record: Record<string, string>;
  /** Múltiples registros extraídos de una sola página (para plantillas XLSX con columnas) */
  records?: Record<string, string>[];
  ocrProcessed: boolean;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface WorkspaceZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variableName: string;
  color: string;
}

export interface WorkspaceSession {
  id: string;
  templateId: string;
  xlsxTemplateId?: string;
  pages: WorkspacePage[];
  savedAt: string;
}

export interface GeneratedFile {
  id: string;
  fileName: string;
  downloadUrl: string;
  type: 'docx' | 'xlsx' | 'zip';
}

// ─── Batch Generation Types ───────────────────────────────────────────────────

export interface BatchRecord {
  pageId: string;
  pageNumber: number;
  values: Record<string, string>;
  confidence: Record<string, number>;
  complete: boolean;
}

export interface BatchGenerationResult {
  files: GeneratedFile[];
  zipDownloadUrl: string;
  errors: Array<{ recordIndex: number; message: string }>;
}

// ─── Upload Types ─────────────────────────────────────────────────────────────

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  error?: string;
}

// ─── Image Processing Types ───────────────────────────────────────────────────

export type FilterType = 'none' | 'grayscale' | 'whiteEnhance' | 'grayscaleWhiteEnhance';

export interface Point {
  x: number;
  y: number;
}

export interface PerspectiveCorrectionState {
  corners: [Point, Point, Point, Point]; // TL, TR, BR, BL
  autoDetected: boolean;
  confirmed: boolean;
}

// ─── API Route Types (Batch & Session) ────────────────────────────────────────

export interface BatchGenerateRequest {
  templateId: string;
  xlsxTemplateId?: string;
  records: Array<Record<string, string>>;
}

export interface BatchGenerateResponse {
  files: Array<{
    id: string;
    fileName: string;
    downloadUrl: string;
    type: 'docx' | 'xlsx';
  }>;
  zipDownloadUrl: string;
  errors: Array<{ recordIndex: number; message: string }>;
}

export interface SaveSessionRequest {
  templateId: string;
  xlsxTemplateId?: string;
  pages: WorkspacePage[];
}
