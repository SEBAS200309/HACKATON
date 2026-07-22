import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
      constructor() {}
    },
    PutObjectCommand: class MockPutObject {
      constructor(public input: any) {}
    },
    GetObjectCommand: class MockGetObject {
      constructor(public input: any) {}
    },
    DeleteObjectCommand: class MockDeleteObject {
      constructor(public input: any) {}
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

describe('StorageService', () => {
  let storageService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    // Re-import to get fresh instance with updated env
    vi.resetModules();
    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: class MockS3Client {
        send = mockSend;
        constructor() {}
      },
      PutObjectCommand: class MockPutObject {
        constructor(public input: any) {}
      },
      GetObjectCommand: class MockGetObject {
        constructor(public input: any) {}
      },
      DeleteObjectCommand: class MockDeleteObject {
        constructor(public input: any) {}
      },
    }));
    vi.doMock('@aws-sdk/s3-request-presigner', () => ({
      getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
    }));

    const module = await import('@/services/storageService');
    storageService = module.storageService;
  });

  describe('putObject', () => {
    it('debe almacenar un archivo en S3 correctamente', async () => {
      mockSend.mockResolvedValueOnce({});

      const body = Buffer.from('contenido de prueba');
      await storageService.putObject('templates/test.docx', body, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar error con mensaje en español cuando falla', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access Denied'));

      const body = Buffer.from('contenido');
      await expect(
        storageService.putObject('templates/test.docx', body, 'text/plain')
      ).rejects.toThrow('Error al almacenar el archivo en S3');
    });
  });

  describe('getObject', () => {
    it('debe obtener un archivo de S3 como Buffer', async () => {
      const content = Buffer.from('contenido del archivo');
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array(content)),
        },
      });

      const result = await storageService.getObject('templates/test.docx');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('contenido del archivo');
    });

    it('debe lanzar error cuando el objeto no existe', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(noSuchKeyError);

      await expect(
        storageService.getObject('templates/inexistente.docx')
      ).rejects.toThrow('El archivo no existe en S3');
    });

    it('debe lanzar error cuando el body es null', async () => {
      mockSend.mockResolvedValueOnce({ Body: null });

      await expect(
        storageService.getObject('templates/vacio.docx')
      ).rejects.toThrow('El objeto no contiene datos');
    });
  });

  describe('deleteObject', () => {
    it('debe eliminar un archivo de S3 correctamente', async () => {
      mockSend.mockResolvedValueOnce({});

      await storageService.deleteObject('templates/test.docx');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar error con mensaje en español cuando falla', async () => {
      mockSend.mockRejectedValueOnce(new Error('InternalError'));

      await expect(
        storageService.deleteObject('templates/test.docx')
      ).rejects.toThrow('Error al eliminar el archivo de S3');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('debe generar URL presignada con expiración por defecto de 1 hora', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://s3.amazonaws.com/test-bucket/test.docx?signature=abc');

      const url = await storageService.getPresignedDownloadUrl('generated/test.docx');

      expect(url).toContain('https://');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 }
      );
    });

    it('debe aceptar expiración personalizada', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://s3.amazonaws.com/test-bucket/test.docx?signature=abc');

      await storageService.getPresignedDownloadUrl('generated/test.docx', 900);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 900 }
      );
    });

    it('debe lanzar error con mensaje en español cuando falla', async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error('SignatureError'));

      await expect(
        storageService.getPresignedDownloadUrl('generated/test.docx')
      ).rejects.toThrow('Error al generar URL de descarga');
    });
  });

  describe('getJsonIndex', () => {
    it('debe retornar array vacío si el index no existe', async () => {
      const noSuchKeyError = new Error('NoSuchKey');
      noSuchKeyError.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(noSuchKeyError);

      const result = await storageService.getJsonIndex('templates');
      expect(result).toEqual([]);
    });

    it('debe parsear array directo desde index.json', async () => {
      const entries = [{ id: '1', name: 'test' }, { id: '2', name: 'test2' }];
      const content = Buffer.from(JSON.stringify(entries));
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array(content)),
        },
      });

      const result = await storageService.getJsonIndex('templates');
      expect(result).toEqual(entries);
    });

    it('debe extraer array desde objeto con propiedad array', async () => {
      const indexContent = { templates: [{ id: '1', name: 'template1' }] };
      const content = Buffer.from(JSON.stringify(indexContent));
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array(content)),
        },
      });

      const result = await storageService.getJsonIndex('templates');
      expect(result).toEqual([{ id: '1', name: 'template1' }]);
    });

    it('debe retornar array vacío si el objeto no tiene propiedades array', async () => {
      const content = Buffer.from(JSON.stringify({ count: 0, status: 'empty' }));
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array(content)),
        },
      });

      const result = await storageService.getJsonIndex('templates');
      expect(result).toEqual([]);
    });
  });

  describe('updateJsonIndex', () => {
    it('debe escribir entries como JSON en {prefix}/index.json', async () => {
      mockSend.mockResolvedValueOnce({}); // putObject call

      const entries = [{ id: '1', name: 'test' }];
      await storageService.updateJsonIndex('templates', entries);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar error con mensaje en español cuando falla', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      await expect(
        storageService.updateJsonIndex('templates', [{ id: '1' }])
      ).rejects.toThrow('Error al actualizar el índice');
    });
  });
});
