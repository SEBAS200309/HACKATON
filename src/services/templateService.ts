import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from './storageService';
import { TemplateMetadata } from '@/types';

/**
 * TemplateService — Gestión de plantillas Word (.docx) y Excel (.xlsx)
 * para el sistema de digitalización de documentos.
 *
 * Funciones principales:
 *   - Subir plantillas con validación de estructura
 *   - Extraer placeholders de documentos Word
 *   - Extraer encabezados de hojas Excel
 *   - Listar y eliminar plantillas
 */

export interface TemplateService {
  uploadTemplate(file: Buffer, fileName: string, type: 'word' | 'xlsx'): Promise<TemplateMetadata>;
  extractPlaceholders(docxBuffer: Buffer): Promise<string[]>;
  extractXlsxHeaders(xlsxBuffer: Buffer): Promise<string[]>;
  validateDocxStructure(buffer: Buffer): Promise<boolean>;
  validateXlsxStructure(buffer: Buffer): Promise<boolean>;
  deleteTemplate(id: string): Promise<void>;
  listTemplates(type?: 'word' | 'xlsx'): Promise<TemplateMetadata[]>;
}

class TemplateServiceImpl implements TemplateService {
  /**
   * Extrae los nombres de placeholders {{variable}} de un documento Word.
   * Retorna nombres únicos sin las llaves.
   */
  async extractPlaceholders(docxBuffer: Buffer): Promise<string[]> {
    const zip = new PizZip(docxBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });

    // Obtener el texto completo del documento para buscar patrones
    const fullText = doc.getFullText();

    // Buscar patrones {{variable}} en el texto completo
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const placeholders = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(fullText)) !== null) {
      placeholders.add(match[1]);
    }

    // También buscar en el XML crudo para capturar placeholders que puedan
    // estar divididos entre múltiples nodos XML
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];

    for (const xmlFile of xmlFiles) {
      try {
        const xmlContent = zip.file(xmlFile)?.asText();
        if (xmlContent) {
          // Limpiar etiquetas XML para obtener texto plano
          const cleanText = xmlContent.replace(/<[^>]+>/g, '');
          let xmlMatch: RegExpExecArray | null;
          const xmlRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
          while ((xmlMatch = xmlRegex.exec(cleanText)) !== null) {
            placeholders.add(xmlMatch[1]);
          }
        }
      } catch {
        // Ignorar archivos que no existen en el ZIP
      }
    }

    return Array.from(placeholders);
  }

  /**
   * Extrae los encabezados (primera fila) de un archivo Excel.
   * Retorna valores no vacíos en orden de columna.
   */
  async extractXlsxHeaders(xlsxBuffer: Buffer): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsxBuffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const firstRow = worksheet.getRow(1);
    const headers: string[] = [];

    firstRow.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        headers.push(String(value).trim());
      }
    });

    return headers;
  }

  /**
   * Valida la estructura OOXML de un archivo .docx
   * Intenta parsear con PizZip para verificar que es un ZIP válido.
   */
  async validateDocxStructure(buffer: Buffer): Promise<boolean> {
    try {
      new PizZip(buffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida la estructura de un archivo .xlsx
   * Intenta cargar con ExcelJS para verificar que es un XLSX válido.
   */
  async validateXlsxStructure(buffer: Buffer): Promise<boolean> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sube una plantilla a S3 con validación de estructura,
   * extracción de metadatos y actualización del índice.
   */
  async uploadTemplate(file: Buffer, fileName: string, type: 'word' | 'xlsx'): Promise<TemplateMetadata> {
    // Validar estructura según el tipo
    if (type === 'word') {
      const isValid = await this.validateDocxStructure(file);
      if (!isValid) {
        throw new Error('El archivo está dañado o no es un documento Word válido');
      }
    } else {
      const isValid = await this.validateXlsxStructure(file);
      if (!isValid) {
        throw new Error('El archivo está dañado o no es un documento Excel válido');
      }
    }

    // Generar ID único y definir la clave S3
    const templateId = uuidv4();
    const extension = type === 'word' ? 'docx' : 'xlsx';
    const s3Key = `templates/${type === 'word' ? 'word' : 'xlsx'}/${templateId}.${extension}`;
    const contentType = type === 'word'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Almacenar archivo en S3
    await storageService.putObject(s3Key, file, contentType);

    // Extraer placeholders o headers según el tipo
    let placeholders: string[] = [];
    if (type === 'word') {
      placeholders = await this.extractPlaceholders(file);
    } else {
      placeholders = await this.extractXlsxHeaders(file);
    }

    // Crear metadata de la plantilla
    const metadata: TemplateMetadata = {
      id: templateId,
      type,
      fileName,
      s3Key,
      fileSize: file.length,
      placeholders,
      uploadDate: new Date().toISOString(),
    };

    // Actualizar el índice de plantillas
    const currentIndex = await storageService.getJsonIndex('templates') as TemplateMetadata[];
    currentIndex.push(metadata);
    await storageService.updateJsonIndex('templates', currentIndex);

    return metadata;
  }

  /**
   * Elimina una plantilla de S3 y actualiza el índice.
   */
  async deleteTemplate(id: string): Promise<void> {
    const currentIndex = await storageService.getJsonIndex('templates') as TemplateMetadata[];
    const template = currentIndex.find((t) => t.id === id);

    if (!template) {
      throw new Error('La plantilla no fue encontrada');
    }

    // Eliminar archivo de S3
    await storageService.deleteObject(template.s3Key);

    // Actualizar índice sin la plantilla eliminada
    const updatedIndex = currentIndex.filter((t) => t.id !== id);
    await storageService.updateJsonIndex('templates', updatedIndex);
  }

  /**
   * Lista todas las plantillas, opcionalmente filtradas por tipo.
   */
  async listTemplates(type?: 'word' | 'xlsx'): Promise<TemplateMetadata[]> {
    const currentIndex = await storageService.getJsonIndex('templates') as TemplateMetadata[];

    if (type) {
      return currentIndex.filter((t) => t.type === type);
    }

    return currentIndex;
  }
}

// Singleton instance para uso en toda la aplicación
export const templateService: TemplateService = new TemplateServiceImpl();
