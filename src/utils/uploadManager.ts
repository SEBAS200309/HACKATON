/**
 * Módulo de gestión de uploads con concurrencia controlada.
 * Implementa cola de archivos, progreso en tiempo real vía XMLHttpRequest,
 * cancelación individual con AbortController, y retry con exponential backoff.
 */

import { v4 as uuidv4 } from 'uuid';
import type { UploadProgress } from '@/types';

export interface UploadOptions {
  maxConcurrent: number;  // default: 3
  maxRetries: number;     // default: 3
  onProgress: (progress: UploadProgress[]) => void;
  onFileComplete?: (fileId: string, response: unknown) => void;
  onFileFailed?: (fileId: string, error: string) => void;
}

interface QueueItem {
  fileId: string;
  file: File;
  type: 'source';
  abortController: AbortController;
  xhr: XMLHttpRequest | null;
  retryCount: number;
  status: UploadProgress['status'];
  progress: number;
  error?: string;
}

const DEFAULT_OPTIONS: UploadOptions = {
  maxConcurrent: 3,
  maxRetries: 3,
  onProgress: () => {},
};

// Intervalo mínimo entre actualizaciones de progreso (ms)
const PROGRESS_THROTTLE_MS = 500;

// Base para exponential backoff (ms)
const BACKOFF_BASE_MS = 2000;

export class UploadManager {
  private options: UploadOptions;
  private queue: Map<string, QueueItem> = new Map();
  private activeCount = 0;
  private lastProgressUpdate = 0;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: Partial<UploadOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Agrega un archivo a la cola de upload.
   * @returns fileId único para rastrear/cancelar el upload.
   */
  enqueue(file: File, type: 'source'): string {
    const fileId = uuidv4();
    const abortController = new AbortController();

    const item: QueueItem = {
      fileId,
      file,
      type,
      abortController,
      xhr: null,
      retryCount: 0,
      status: 'pending',
      progress: 0,
    };

    this.queue.set(fileId, item);
    this.notifyProgress();
    this.processQueue();

    return fileId;
  }

  /**
   * Cancela un upload individual por su fileId.
   */
  cancel(fileId: string): void {
    const item = this.queue.get(fileId);
    if (!item) return;

    if (item.status === 'uploading') {
      item.abortController.abort();
      if (item.xhr) {
        item.xhr.abort();
        item.xhr = null;
      }
      this.activeCount = Math.max(0, this.activeCount - 1);
    }

    item.status = 'cancelled';
    item.progress = 0;
    this.notifyProgress();
    this.processQueue();
  }

  /**
   * Cancela todos los uploads activos y pendientes.
   */
  cancelAll(): void {
    const entries = Array.from(this.queue.entries());
    for (const [fileId, item] of entries) {
      if (item.status === 'pending' || item.status === 'uploading') {
        this.cancel(fileId);
      }
    }
  }

  /**
   * Retorna el estado de progreso de todos los uploads en cola.
   */
  getProgress(): UploadProgress[] {
    const items = Array.from(this.queue.values());
    return items.map((item) => ({
      fileId: item.fileId,
      fileName: item.file.name,
      progress: item.progress,
      status: item.status,
      retryCount: item.retryCount,
      error: item.error,
    }));
  }

  /**
   * Procesa la cola de uploads respetando el límite de concurrencia.
   */
  private processQueue(): void {
    if (this.activeCount >= this.options.maxConcurrent) return;

    const items = Array.from(this.queue.values());
    for (let i = 0; i < items.length; i++) {
      if (this.activeCount >= this.options.maxConcurrent) break;
      if (items[i].status === 'pending') {
        this.startUpload(items[i]);
      }
    }
  }

  /**
   * Inicia el upload de un archivo usando XMLHttpRequest para tracking de progreso.
   */
  private startUpload(item: QueueItem): void {
    item.status = 'uploading';
    item.progress = 0;
    this.activeCount++;
    this.notifyProgress();

    const xhr = new XMLHttpRequest();
    item.xhr = xhr;

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('type', item.type);
    formData.append('fileName', item.file.name);

    // Tracking de progreso con throttle de 500ms
    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        item.progress = Math.round((event.loaded / event.total) * 100);
        this.throttledNotifyProgress();
      }
    };

    xhr.onload = () => {
      item.xhr = null;

      if (xhr.status >= 200 && xhr.status < 300) {
        item.status = 'completed';
        item.progress = 100;
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.notifyProgress();

        // Notify file completion with parsed response
        if (this.options.onFileComplete) {
          try {
            const response = JSON.parse(xhr.responseText);
            this.options.onFileComplete(item.fileId, response);
          } catch {
            this.options.onFileComplete(item.fileId, null);
          }
        }

        this.processQueue();
      } else {
        this.handleUploadError(item, `Error del servidor: ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      item.xhr = null;
      this.handleUploadError(item, 'Error de red');
    };

    xhr.onabort = () => {
      item.xhr = null;
      // La cancelación ya se maneja en cancel()
    };

    // Escuchar señal de abort del AbortController
    item.abortController.signal.addEventListener('abort', () => {
      if (item.xhr) {
        item.xhr.abort();
        item.xhr = null;
      }
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  /**
   * Maneja errores de upload, implementando retry con exponential backoff.
   */
  private handleUploadError(item: QueueItem, errorMessage: string): void {
    this.activeCount = Math.max(0, this.activeCount - 1);

    if (item.status === 'cancelled') {
      this.processQueue();
      return;
    }

    if (item.retryCount < this.options.maxRetries) {
      item.retryCount++;
      item.status = 'pending';
      item.progress = 0;

      // Exponential backoff: 2s, 4s, 8s
      const delayMs = BACKOFF_BASE_MS * Math.pow(2, item.retryCount - 1);

      this.notifyProgress();

      setTimeout(() => {
        // Verificar que no fue cancelado durante el backoff
        if (item.status === 'pending') {
          this.processQueue();
        }
      }, delayMs);
    } else {
      item.status = 'failed';
      item.error = 'Error al cargar el archivo. Verifique su conexión e intente nuevamente';
      this.notifyProgress();

      // Notify file failure
      if (this.options.onFileFailed) {
        this.options.onFileFailed(item.fileId, item.error);
      }

      this.processQueue();
    }
  }

  /**
   * Notifica el progreso actual de forma throttled (máximo cada 500ms).
   */
  private throttledNotifyProgress(): void {
    const now = Date.now();
    const elapsed = now - this.lastProgressUpdate;

    if (elapsed >= PROGRESS_THROTTLE_MS) {
      this.notifyProgress();
    } else if (!this.progressTimer) {
      this.progressTimer = setTimeout(() => {
        this.progressTimer = null;
        this.notifyProgress();
      }, PROGRESS_THROTTLE_MS - elapsed);
    }
  }

  /**
   * Emite la notificación de progreso al callback configurado.
   */
  private notifyProgress(): void {
    this.lastProgressUpdate = Date.now();
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
    this.options.onProgress(this.getProgress());
  }
}
