"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button, LoadingSpinner } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { UploadManager } from "@/utils/uploadManager";
import { shouldCompress, compressImage } from "@/utils/imageCompression";
import { UploadProgressBar } from "@/components/ui/UploadProgressBar";
import CameraCapture from "./CameraCapture";
import FileUpload from "./FileUpload";
import type { UploadProgress } from "@/types";

export interface DocumentCaptureProps {
  onDocumentReady: (documentUrl: string, s3Key: string) => void;
  onRetake: () => void;
  /** When provided, captures the raw blob and calls this instead of uploading */
  onBlobCaptured?: (blob: Blob) => void;
}

type CaptureState = "idle" | "uploading" | "preview";

interface UploadedDocument {
  url: string;
  s3Key: string;
  fileName: string;
}

export default function DocumentCapture({ onDocumentReady, onRetake, onBlobCaptured }: DocumentCaptureProps) {
  const [state, setState] = useState<CaptureState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const addToast = useAppStore((s) => s.addToast);

  // Track pending upload file IDs to correlate responses
  const pendingUploadRef = useRef<{
    fileId: string;
    file: File | Blob;
    fileName: string;
  } | null>(null);

  const uploadManagerRef = useRef<UploadManager | null>(null);

  const getUploadManager = useCallback(() => {
    if (!uploadManagerRef.current) {
      uploadManagerRef.current = new UploadManager({
        maxConcurrent: 3,
        maxRetries: 3,
        onProgress: (progress) => {
          setUploads([...progress]);
        },
        onFileComplete: (fileId, response) => {
          const pending = pendingUploadRef.current;
          if (pending && pending.fileId === fileId && response) {
            const result = response as { s3Key?: string; fileName?: string };
            if (result.s3Key) {
              const localUrl = URL.createObjectURL(pending.file);
              setPreviewUrl(localUrl);
              setUploadedDoc({
                url: localUrl,
                s3Key: result.s3Key,
                fileName: result.fileName || pending.fileName,
              });
              setState("preview");
            } else {
              addToast({
                type: "error",
                message: "Error al cargar el documento. Respuesta inválida del servidor",
              });
              setState("idle");
            }
            pendingUploadRef.current = null;
          }
        },
        onFileFailed: (fileId, error) => {
          const pending = pendingUploadRef.current;
          if (pending && pending.fileId === fileId) {
            addToast({
              type: "error",
              message: error || "Error al cargar el documento. Verifique su conexión e intente nuevamente",
            });
            setState("idle");
            pendingUploadRef.current = null;
          }
        },
      });
    }
    return uploadManagerRef.current;
  }, [addToast]);

  const uploadFile = useCallback(
    async (file: File | Blob, fileName?: string) => {
      setState("uploading");
      const name = fileName || "captura.jpg";

      try {
        let fileToUpload: File;

        // Convert Blob to File if necessary for compression check
        if (file instanceof File) {
          fileToUpload = file;
        } else {
          fileToUpload = new File([file], name, { type: file.type || "image/jpeg" });
        }

        // Apply intelligent compression if file > 2MB
        if (shouldCompress(fileToUpload)) {
          try {
            const compressionResult = await compressImage(fileToUpload);
            fileToUpload = new File([compressionResult.blob], name, {
              type: "image/jpeg",
            });
            addToast({
              type: "success",
              message: "Imagen comprimida automáticamente para optimizar la carga",
            });
          } catch {
            // If compression fails, use original file
            addToast({
              type: "warning",
              message: "No se pudo comprimir la imagen. Se usará el archivo original",
            });
          }
        }

        // Use UploadManager for upload with progress, retry, and cancel
        const manager = getUploadManager();
        const fileId = manager.enqueue(fileToUpload, "source");

        // Store pending upload info to correlate with completion callback
        pendingUploadRef.current = {
          fileId,
          file: fileToUpload,
          fileName: name,
        };
      } catch {
        addToast({
          type: "error",
          message: "Error al preparar el archivo para carga",
        });
        setState("idle");
      }
    },
    [addToast, getUploadManager]
  );

  const handleCancelUpload = useCallback(
    (fileId: string) => {
      const manager = getUploadManager();
      manager.cancel(fileId);

      const pending = pendingUploadRef.current;
      if (pending && pending.fileId === fileId) {
        pendingUploadRef.current = null;
        setState("idle");
        addToast({ type: "warning", message: "Carga cancelada" });
      }
    },
    [getUploadManager, addToast]
  );

  const handleCameraCapture = useCallback(
    (imageBlob: Blob) => {
      if (onBlobCaptured) {
        onBlobCaptured(imageBlob);
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      uploadFile(imageBlob, `captura-${timestamp}.jpg`);
    },
    [uploadFile, onBlobCaptured]
  );

  const handleCameraError = useCallback((error: string) => {
    setCameraError(error);
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      if (onBlobCaptured) {
        onBlobCaptured(file);
        return;
      }
      uploadFile(file, file.name);
    },
    [uploadFile, onBlobCaptured]
  );

  const handleConfirm = useCallback(() => {
    if (uploadedDoc) {
      onDocumentReady(uploadedDoc.url, uploadedDoc.s3Key);
    }
  }, [uploadedDoc, onDocumentReady]);

  const handleRetake = useCallback(() => {
    // Revoke the object URL to avoid memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedDoc(null);
    setPreviewUrl(null);
    setCameraError(null);
    setUploads([]);
    setState("idle");
    onRetake();
  }, [previewUrl, onRetake]);

  // ─── Preview state ──────────────────────────────────────────────────────────
  if (state === "preview" && uploadedDoc) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <h3 className="text-lg font-medium text-gray-200">
          Vista previa del documento
        </h3>

        <div className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-700 bg-dark-surface">
          {uploadedDoc.fileName.toLowerCase().endsWith(".pdf") ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2">
              <svg
                className="h-16 w-16 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-400">{uploadedDoc.fileName}</p>
              <p className="text-xs text-gray-500">Documento PDF cargado correctamente</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadedDoc.url}
              alt="Vista previa del documento capturado"
              className="w-full h-auto object-contain max-h-96"
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            className="flex-1"
          >
            Confirmar
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleRetake}
            className="flex-1"
          >
            Volver a capturar
          </Button>
        </div>
      </div>
    );
  }

  // ─── Uploading state ────────────────────────────────────────────────────────
  if (state === "uploading") {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4">
        {uploads.length > 0 ? (
          <div className="w-full max-w-lg">
            <UploadProgressBar uploads={uploads} onCancel={handleCancelUpload} />
          </div>
        ) : (
          <LoadingSpinner size="lg" message="Preparando archivo..." />
        )}
      </div>
    );
  }

  // ─── Idle state (capture modes) ────────────────────────────────────────────
  // Detect mobile device for native camera capture
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="flex flex-col gap-6 w-full">
      <h3 className="text-lg font-medium text-gray-200">
        Capturar o cargar documento
      </h3>

      {/* Mobile: native camera input */}
      {isMobile && (
        <div className="w-full">
          <p className="text-sm text-gray-400 mb-3">Tomar foto con la cámara</p>
          <label
            className="flex flex-col items-center justify-center w-full p-6 rounded-lg border-2 border-dashed border-purple-primary/50 bg-[#1a1025] cursor-pointer hover:border-purple-primary transition-colors"
          >
            <svg
              className="h-10 w-10 text-purple-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
            <span className="text-sm font-medium text-purple-400">
              Tomar foto del documento
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Se abrirá la cámara del dispositivo
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelected(file);
                }
              }}
            />
          </label>
        </div>
      )}

      {/* Desktop: getUserMedia camera */}
      {!isMobile && !cameraError && (
        <div className="w-full">
          <p className="text-sm text-gray-400 mb-3">Capturar con cámara</p>
          <CameraCapture onCapture={handleCameraCapture} onError={handleCameraError} />
        </div>
      )}

      {/* Camera fallback message (desktop only) */}
      {!isMobile && cameraError && (
        <div
          className="w-full p-4 rounded-lg bg-dark-surface border border-gray-700"
          role="alert"
        >
          <p className="text-sm text-gray-300">{cameraError}</p>
        </div>
      )}

      {/* Separator */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-xs text-gray-500 uppercase">o</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      {/* File upload section */}
      <div className="w-full">
        <p className="text-sm text-gray-400 mb-3">Cargar archivo escaneado</p>
        <FileUpload onFileSelected={handleFileSelected} />
      </div>
    </div>
  );
}
