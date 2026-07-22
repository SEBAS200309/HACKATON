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
