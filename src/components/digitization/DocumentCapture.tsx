"use client";

import React, { useCallback, useState } from "react";
import { Button, LoadingSpinner } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import CameraCapture from "./CameraCapture";
import FileUpload from "./FileUpload";

export interface DocumentCaptureProps {
  onDocumentReady: (documentUrl: string, s3Key: string) => void;
  onRetake: () => void;
}

type CaptureState = "idle" | "uploading" | "preview";

interface UploadedDocument {
  url: string;
  s3Key: string;
  fileName: string;
}

export default function DocumentCapture({ onDocumentReady, onRetake }: DocumentCaptureProps) {
  const [state, setState] = useState<CaptureState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const addToast = useAppStore((s) => s.addToast);

  const uploadFile = useCallback(
    async (file: File | Blob, fileName?: string) => {
      setState("uploading");

      try {
        const formData = new FormData();
        formData.append("file", file, fileName || "captura.jpg");
        formData.append("type", "source");
        formData.append("fileName", fileName || "captura.jpg");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          const message =
            data?.error?.message ||
            "Error al cargar el documento. Verifique su conexión e intente nuevamente";
          addToast({ type: "error", message });
          setState("idle");
          return;
        }

        const result = await response.json();

        // Create a local preview URL
        const localUrl = URL.createObjectURL(file);
        setPreviewUrl(localUrl);
        setUploadedDoc({
          url: localUrl,
          s3Key: result.s3Key,
          fileName: result.fileName || fileName || "captura.jpg",
        });
        setState("preview");
      } catch {
        addToast({
          type: "error",
          message: "Error al cargar el documento. Verifique su conexión e intente nuevamente",
        });
        setState("idle");
      }
    },
    [addToast]
  );

  const handleCameraCapture = useCallback(
    (imageBlob: Blob) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      uploadFile(imageBlob, `captura-${timestamp}.jpg`);
    },
    [uploadFile]
  );

  const handleCameraError = useCallback((error: string) => {
    setCameraError(error);
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      uploadFile(file, file.name);
    },
    [uploadFile]
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
        <LoadingSpinner size="lg" message="Subiendo documento..." />
      </div>
    );
  }

  // ─── Idle state (capture modes) ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full">
      <h3 className="text-lg font-medium text-gray-200">
        Capturar o cargar documento
      </h3>

      {/* Camera section */}
      {!cameraError && (
        <div className="w-full">
          <p className="text-sm text-gray-400 mb-3">Capturar con cámara</p>
          <CameraCapture onCapture={handleCameraCapture} onError={handleCameraError} />
        </div>
      )}

      {/* Camera fallback message */}
      {cameraError && (
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
