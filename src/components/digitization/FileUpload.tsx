"use client";

import React, { useCallback, useRef, useState } from "react";

export interface FileUploadProps {
  onFileSelected: (file: File) => void;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];
const ACCEPT_STRING = ".pdf,.png,.jpg,.jpeg";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

export default function FileUpload({ onFileSelected }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const extension = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      return "Formato no soportado. Solo se permiten archivos PDF, PNG o JPG";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "El archivo excede el tamaño máximo permitido de 25MB";
    }
    return null;
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      onFileSelected(file);
    },
    [validateFile, onFileSelected]
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
      e.target.value = "";
    },
    [handleFileSelected]
  );

  const handleClickZone = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-label="Subir documento escaneado (PDF, PNG o JPG)"
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
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>

        <p className="text-sm text-gray-400 text-center">
          Arrastra un archivo aquí o{" "}
          <span className="text-purple-primary font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-gray-500">PDF, PNG o JPG — Máximo 25 MB</p>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
