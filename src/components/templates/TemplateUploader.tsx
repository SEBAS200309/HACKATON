"use client";

import React, { useCallback, useRef, useState } from "react";
import { Button, Modal, Input } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import type { TemplateMetadata } from "@/types";

interface TemplateUploaderProps {
  type: "word" | "xlsx";
  onUploadComplete: (template: TemplateMetadata) => void;
  existingTemplates: TemplateMetadata[];
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const acceptMap: Record<string, string> = {
  word: ".docx",
  xlsx: ".xlsx",
};

const labelMap: Record<string, string> = {
  word: "Word (.docx)",
  xlsx: "Excel (.xlsx)",
};

export default function TemplateUploader({
  type,
  onUploadComplete,
  existingTemplates,
}: TemplateUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const addToast = useAppStore((s) => s.addToast);

  const validateFile = useCallback(
    (file: File): string | null => {
      const expectedExt = acceptMap[type];
      const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (fileExt !== expectedExt) {
        return `Formato no soportado. Solo se permiten archivos ${labelMap[type]}`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return "El archivo excede el tamaño máximo permitido de 25MB";
      }
      return null;
    },
    [type]
  );

  const checkDuplicate = useCallback(
    (fileName: string): boolean => {
      return existingTemplates.some(
        (t) => t.fileName.toLowerCase() === fileName.toLowerCase()
      );
    },
    [existingTemplates]
  );

  const uploadFile = useCallback(
    async (file: File, fileName?: string) => {
      setUploading(true);
      setProgress(0);
      setError(null);

      const finalName = fileName || file.name;

      try {
        // Simulate progress for UX
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        formData.append("fileName", finalName);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const data = await response.json();
          const message =
            data?.error?.message ||
            "Error al cargar el archivo. Verifique su conexión e intente nuevamente";
          setError(message);
          addToast({ type: "error", message });
          return;
        }

        setProgress(100);
        const template: TemplateMetadata = await response.json();

        // Check for empty placeholders on word templates
        if (type === "word" && template.placeholders.length === 0) {
          addToast({
            type: "warning",
            message:
              "No se detectaron variables (placeholders) en esta plantilla",
          });
        }

        addToast({ type: "success", message: "Plantilla cargada exitosamente" });
        onUploadComplete(template);
      } catch {
        const message =
          "Error al cargar el archivo. Verifique su conexión e intente nuevamente";
        setError(message);
        addToast({ type: "error", message });
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [type, addToast, onUploadComplete]
  );

  const handleFileSelected = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        addToast({ type: "error", message: validationError });
        return;
      }

      if (checkDuplicate(file.name)) {
        setDuplicateFile(file);
        setRenameValue(file.name);
        setShowDuplicateModal(true);
        return;
      }

      uploadFile(file);
    },
    [validateFile, checkDuplicate, uploadFile, addToast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelected(file);
      }
    },
    [handleFileSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelected(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFileSelected]
  );

  const handleClickZone = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDuplicateReplace = useCallback(() => {
    if (duplicateFile) {
      setShowDuplicateModal(false);
      uploadFile(duplicateFile);
      setDuplicateFile(null);
    }
  }, [duplicateFile, uploadFile]);

  const handleDuplicateRename = useCallback(() => {
    if (duplicateFile && renameValue.trim()) {
      setShowDuplicateModal(false);
      uploadFile(duplicateFile, renameValue.trim());
      setDuplicateFile(null);
    }
  }, [duplicateFile, renameValue, uploadFile]);

  const handleDuplicateCancel = useCallback(() => {
    setShowDuplicateModal(false);
    setDuplicateFile(null);
  }, []);

  return (
    <div className="w-full">
      {/* Drag-drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Subir archivo ${labelMap[type]}`}
        onClick={handleClickZone}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClickZone();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-3
          w-full p-6 rounded-xl border-2 border-dashed
          cursor-pointer transition-colors duration-200
          ${
            isDragOver
              ? "border-purple-primary bg-purple-primary/10"
              : "border-gray-700 hover:border-purple-primary/60 bg-dark-surface"
          }
          ${uploading ? "pointer-events-none opacity-70" : ""}
        `}
      >
        {/* Upload icon */}
        <svg
          className="h-10 w-10 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="text-sm text-gray-400 text-center">
          Arrastra un archivo {labelMap[type]} aquí o{" "}
          <span className="text-purple-primary font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-gray-500">Máximo 25 MB</p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptMap[type]}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Subiendo archivo...</span>
            <span className="text-xs text-gray-400">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !uploading && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Duplicate name modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={handleDuplicateCancel}
        title="Archivo duplicado"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-300">
            Ya existe una plantilla con el nombre{" "}
            <strong className="text-gray-100">
              &quot;{duplicateFile?.name}&quot;
            </strong>
            . ¿Desea reemplazarla o guardar con otro nombre?
          </p>

          <Input
            label="Nuevo nombre"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="danger" size="sm" onClick={handleDuplicateReplace}>
              Reemplazar existente
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDuplicateRename}
              disabled={!renameValue.trim() || renameValue === duplicateFile?.name}
            >
              Guardar con nuevo nombre
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDuplicateCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
