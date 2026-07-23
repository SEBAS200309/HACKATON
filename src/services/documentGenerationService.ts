import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';
import { storageService } from './storageService';

/**
 * DocumentGenerationService — Generación de documentos Word (.docx) y Excel (.xlsx)
 * completados con variables extraídas del proceso de digitalización.
 *
 * Funciones principales:
 *   - Llenar plantillas Word reemplazando placeholders {{variable}} con valores
 *   - Llenar plantillas Excel agregando una nueva fila con datos mapeados a encabezados
 */

export interface DocumentGenerationService {
  fillWordTemplate(templateKey: string, variables: Record<string, string>): Promise<Buffer>;
  fillXlsxTemplate(templateKey: string, variables: Record<string, string>): Promise<Buffer>;
}

class DocumentGenerationServiceImpl implements DocumentGenerationService {
  /**
   * Carga una plantilla Word desde S3 y rellena los placeholders {{variable}}
   * con los valores proporcionados. Variables faltantes se dejan vacías.
   */
  async fillWordTemplate(
    templateKey: string,
    variables: Record<string, string>
  ): Promise<Buffer> {
    try {
      const templateBuffer = await storageService.getObject(templateKey);

      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: () => '',
      });

      doc.setData(variables);
      doc.render();

      const outputBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      return outputBuffer;
    } catch (error) {
      throw new Error(
        `Error al generar el documento Word (key: ${templateKey}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Carga una plantilla Excel desde S3, encuentra la última fila con datos,
   * y agrega una nueva fila mapeando los valores de variables a los encabezados
   * de columna (comparación case-sensitive exacta).
   * Variables faltantes se dejan como celda vacía.
   */
  async fillXlsxTemplate(
    templateKey: string,
    variables: Record<string, string>
  ): Promise<Buffer> {
    try {
      const templateBuffer = await storageService.getObject(templateKey);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('La plantilla Excel no contiene hojas de trabajo');
      }

      // Extraer encabezados de la primera fila
      const headerRow = worksheet.getRow(1);
      const headers: { column: number; name: string }[] = [];

      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const value = cell.value;
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          headers.push({ column: colNumber, name: String(value).trim() });
        }
      });

      // Encontrar la última fila con datos
      let lastDataRow = 1; // Al menos la fila de headers
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > lastDataRow) {
          lastDataRow = rowNumber;
        }
      });

      // Agregar nueva fila después de la última fila con datos
      const newRowNumber = lastDataRow + 1;
      const newRow = worksheet.getRow(newRowNumber);

      for (const header of headers) {
        // Comparación case-sensitive exacta entre header y variable
        const value = variables[header.name];
        if (value !== undefined) {
          newRow.getCell(header.column).value = value;
        }
        // Si la variable no está proporcionada, la celda se deja vacía
      }

      newRow.commit();

      const outputBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(outputBuffer);
    } catch (error) {
      throw new Error(
        `Error al completar la plantilla Excel (key: ${templateKey}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Singleton instance para uso en toda la aplicación
export const documentGenerationService: DocumentGenerationService =
  new DocumentGenerationServiceImpl();
