import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * StorageService — Wrapper sobre Amazon S3 para gestión de archivos
 * del sistema de digitalización de documentos.
 *
 * Bucket structure:
 *   templates/   — Plantillas Word y Excel
 *   sources/     — Documentos fuente escaneados/cargados
 *   generated/   — Documentos generados (.docx, .xlsx)
 *   configs/     — Configuraciones de segmentación (JSON)
 */

export interface StorageService {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getPresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getJsonIndex(prefix: string): Promise<unknown[]>;
  updateJsonIndex(prefix: string, entries: unknown[]): Promise<void>;
}

const DEFAULT_DOWNLOAD_EXPIRY = 3600; // 1 hora en segundos

class S3StorageService implements StorageService {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Error al almacenar el archivo en S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error(`El objeto no contiene datos (key: ${key})`);
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        throw new Error(`El archivo no existe en S3 (key: ${key})`);
      }
      throw new Error(
        `Error al obtener el archivo de S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
    } catch (error) {
      throw new Error(
        `Error al eliminar el archivo de S3 (key: ${key}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_DOWNLOAD_EXPIRY
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const url = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
      return url;
    } catch (error) {
      throw new Error(
        `Error al generar URL de descarga (key: ${key}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getJsonIndex(prefix: string): Promise<unknown[]> {
    try {
      const indexKey = `${prefix}/index.json`;
      const buffer = await this.getObject(indexKey);
      const content = JSON.parse(buffer.toString('utf-8'));

      // El index puede ser un array directo o un objeto con una propiedad array
      if (Array.isArray(content)) {
        return content;
      }

      // Buscar la primera propiedad que sea un array
      const arrayProp = Object.values(content).find((val) => Array.isArray(val));
      return (arrayProp as unknown[]) || [];
    } catch (error) {
      // Si el archivo no existe, retornar array vacío
      if (
        error instanceof Error &&
        (error.message.includes('no existe') || error.message.includes('NoSuchKey'))
      ) {
        return [];
      }
      throw error;
    }
  }

  async updateJsonIndex(prefix: string, entries: unknown[]): Promise<void> {
    try {
      const indexKey = `${prefix}/index.json`;
      const body = Buffer.from(JSON.stringify(entries, null, 2), 'utf-8');
      await this.putObject(indexKey, body, 'application/json');
    } catch (error) {
      throw new Error(
        `Error al actualizar el índice (prefix: ${prefix}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Singleton instance para uso en toda la aplicación
export const storageService: StorageService = new S3StorageService();
