import { describe, it, expect, vi, beforeEach } from 'vitest';
import PizZip from 'pizzip';
import ExcelJS from 'exceljs';

// Mock storageService
const mockPutObject = vi.fn();
const mockGetObject = vi.fn();
const mockDeleteObject = vi.fn();
const mockGetJsonIndex = vi.fn();
const mockUpdateJsonIndex = vi.fn();

vi.mock('@/services/storageService', () => ({
  storageService: {
    putObject: (...args: any[]) => mockPutObject(...args),
    getObject: (...args: any[]) => mockGetObject(...args),
    deleteObject: (...args: any[]) => mockDeleteObject(...args),
    getJsonIndex: (...args: any[]) => mockGetJsonIndex(...args),
    updateJsonIndex: (...args: any[]) => mockUpdateJsonIndex(...args),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

/**
 * Crea un buffer .docx válido con el contenido de texto especificado.
 */
function createDocxBuffer(textContent: string): Buffer {
  const zip = new PizZip();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${textContent}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  return Buffer.from(zip.generate({ type: 'nodebuffer' }));
}

/**
 * Crea un buffer .xlsx válido con los encabezados especificados en la primera fila.
 */
async function createXlsxBuffer(headers: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  if (headers.length > 0) {
    worksheet.addRow(headers);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('TemplateService', () => {
  let templateService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetJsonIndex.mockResolvedValue([]);
    mockUpdateJsonIndex.mockResolvedValue(undefined);
    mockPutObject.mockResolvedValue(undefined);
    mockDeleteObject.mockResolvedValue(undefined);

    // Re-import para obtener instancia fresca
    vi.resetModules();
    vi.doMock('@/services/storageService', () => ({
      storageService: {
        putObject: (...args: any[]) => mockPutObject(...args),
        getObject: (...args: any[]) => mockGetObject(...args),
        deleteObject: (...args: any[]) => mockDeleteObject(...args),
        getJsonIndex: (...args: any[]) => mockGetJsonIndex(...args),
        updateJsonIndex: (...args: any[]) => mockUpdateJsonIndex(...args),
      },
    }));
    vi.doMock('uuid', () => ({
      v4: () => 'test-uuid-1234',
    }));

    const module = await import('@/services/templateService');
    templateService = module.templateService;
  });

  describe('extractPlaceholders', () => {
    it('debe extraer placeholders {{variable}} de un documento Word', async () => {
      const docxBuffer = createDocxBuffer('Nombre: {{nombre_completo}} Fecha: {{fecha}}');

      const result = await templateService.extractPlaceholders(docxBuffer);

      expect(result).toContain('nombre_completo');
      expect(result).toContain('fecha');
      expect(result.length).toBe(2);
    });

    it('debe retornar array vacío si no hay placeholders', async () => {
      const docxBuffer = createDocxBuffer('Este documento no tiene variables');

      const result = await templateService.extractPlaceholders(docxBuffer);

      expect(result).toEqual([]);
    });

    it('debe retornar nombres únicos sin duplicados', async () => {
      const docxBuffer = createDocxBuffer('{{nombre}} y {{nombre}} repetido');

      const result = await templateService.extractPlaceholders(docxBuffer);

      expect(result).toEqual(['nombre']);
    });

    it('debe extraer placeholders con underscores y números', async () => {
      const docxBuffer = createDocxBuffer('{{var_1}} {{campo2}} {{a_b_c}}');

      const result = await templateService.extractPlaceholders(docxBuffer);

      expect(result).toContain('var_1');
      expect(result).toContain('campo2');
      expect(result).toContain('a_b_c');
    });
  });

  describe('extractXlsxHeaders', () => {
    it('debe extraer encabezados no vacíos de la primera fila', async () => {
      const xlsxBuffer = await createXlsxBuffer(['Nombre', 'Apellido', 'Edad']);

      const result = await templateService.extractXlsxHeaders(xlsxBuffer);

      expect(result).toEqual(['Nombre', 'Apellido', 'Edad']);
    });

    it('debe retornar array vacío si no hay encabezados', async () => {
      const xlsxBuffer = await createXlsxBuffer([]);

      const result = await templateService.extractXlsxHeaders(xlsxBuffer);

      expect(result).toEqual([]);
    });

    it('debe respetar el orden de las columnas', async () => {
      const xlsxBuffer = await createXlsxBuffer(['Zebra', 'Alfa', 'Medio']);

      const result = await templateService.extractXlsxHeaders(xlsxBuffer);

      expect(result).toEqual(['Zebra', 'Alfa', 'Medio']);
    });
  });

  describe('validateDocxStructure', () => {
    it('debe retornar true para un .docx válido', async () => {
      const validDocx = createDocxBuffer('contenido válido');

      const result = await templateService.validateDocxStructure(validDocx);

      expect(result).toBe(true);
    });

    it('debe retornar false para un buffer inválido', async () => {
      const invalidBuffer = Buffer.from('esto no es un archivo zip');

      const result = await templateService.validateDocxStructure(invalidBuffer);

      expect(result).toBe(false);
    });
  });

  describe('validateXlsxStructure', () => {
    it('debe retornar true para un .xlsx válido', async () => {
      const validXlsx = await createXlsxBuffer(['Header1']);

      const result = await templateService.validateXlsxStructure(validXlsx);

      expect(result).toBe(true);
    });

    it('debe retornar false para un buffer inválido', async () => {
      const invalidBuffer = Buffer.from('esto no es un archivo xlsx');

      const result = await templateService.validateXlsxStructure(invalidBuffer);

      expect(result).toBe(false);
    });
  });

  describe('uploadTemplate', () => {
    it('debe subir una plantilla Word correctamente', async () => {
      const docxBuffer = createDocxBuffer('{{nombre}} {{fecha}}');

      const result = await templateService.uploadTemplate(docxBuffer, 'plantilla.docx', 'word');

      expect(result.id).toBe('test-uuid-1234');
      expect(result.type).toBe('word');
      expect(result.fileName).toBe('plantilla.docx');
      expect(result.s3Key).toBe('templates/word/test-uuid-1234.docx');
      expect(result.fileSize).toBe(docxBuffer.length);
      expect(result.placeholders).toContain('nombre');
      expect(result.placeholders).toContain('fecha');
      expect(result.uploadDate).toBeDefined();
      expect(mockPutObject).toHaveBeenCalledWith(
        'templates/word/test-uuid-1234.docx',
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(mockUpdateJsonIndex).toHaveBeenCalledWith('templates', expect.any(Array));
    });

    it('debe subir una plantilla Excel correctamente', async () => {
      const xlsxBuffer = await createXlsxBuffer(['Nombre', 'Edad']);

      const result = await templateService.uploadTemplate(xlsxBuffer, 'datos.xlsx', 'xlsx');

      expect(result.id).toBe('test-uuid-1234');
      expect(result.type).toBe('xlsx');
      expect(result.s3Key).toBe('templates/xlsx/test-uuid-1234.xlsx');
      expect(result.placeholders).toContain('Nombre');
      expect(result.placeholders).toContain('Edad');
      expect(mockPutObject).toHaveBeenCalledWith(
        'templates/xlsx/test-uuid-1234.xlsx',
        xlsxBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('debe rechazar un archivo Word con estructura inválida', async () => {
      const invalidBuffer = Buffer.from('archivo corrupto');

      await expect(
        templateService.uploadTemplate(invalidBuffer, 'corrupto.docx', 'word')
      ).rejects.toThrow('El archivo está dañado o no es un documento Word válido');
    });

    it('debe rechazar un archivo Excel con estructura inválida', async () => {
      const invalidBuffer = Buffer.from('archivo corrupto');

      await expect(
        templateService.uploadTemplate(invalidBuffer, 'corrupto.xlsx', 'xlsx')
      ).rejects.toThrow('El archivo está dañado o no es un documento Excel válido');
    });
  });

  describe('deleteTemplate', () => {
    it('debe eliminar una plantilla existente del índice y S3', async () => {
      const existingTemplates = [
        { id: 'template-1', type: 'word', s3Key: 'templates/word/template-1.docx', fileName: 'test.docx' },
        { id: 'template-2', type: 'xlsx', s3Key: 'templates/xlsx/template-2.xlsx', fileName: 'data.xlsx' },
      ];
      mockGetJsonIndex.mockResolvedValue(existingTemplates);

      await templateService.deleteTemplate('template-1');

      expect(mockDeleteObject).toHaveBeenCalledWith('templates/word/template-1.docx');
      expect(mockUpdateJsonIndex).toHaveBeenCalledWith(
        'templates',
        [{ id: 'template-2', type: 'xlsx', s3Key: 'templates/xlsx/template-2.xlsx', fileName: 'data.xlsx' }]
      );
    });

    it('debe lanzar error si la plantilla no existe', async () => {
      mockGetJsonIndex.mockResolvedValue([]);

      await expect(
        templateService.deleteTemplate('inexistente')
      ).rejects.toThrow('La plantilla no fue encontrada');
    });
  });

  describe('listTemplates', () => {
    const mockTemplates = [
      { id: '1', type: 'word', fileName: 'doc1.docx' },
      { id: '2', type: 'xlsx', fileName: 'data1.xlsx' },
      { id: '3', type: 'word', fileName: 'doc2.docx' },
    ];

    it('debe retornar todas las plantillas si no se especifica tipo', async () => {
      mockGetJsonIndex.mockResolvedValue(mockTemplates);

      const result = await templateService.listTemplates();

      expect(result).toEqual(mockTemplates);
    });

    it('debe filtrar por tipo word', async () => {
      mockGetJsonIndex.mockResolvedValue(mockTemplates);

      const result = await templateService.listTemplates('word');

      expect(result).toHaveLength(2);
      expect(result.every((t: any) => t.type === 'word')).toBe(true);
    });

    it('debe filtrar por tipo xlsx', async () => {
      mockGetJsonIndex.mockResolvedValue(mockTemplates);

      const result = await templateService.listTemplates('xlsx');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('xlsx');
    });

    it('debe retornar array vacío si no hay plantillas', async () => {
      mockGetJsonIndex.mockResolvedValue([]);

      const result = await templateService.listTemplates();

      expect(result).toEqual([]);
    });
  });
});
