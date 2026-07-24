"use client";

import React from "react";
import type { UploadProgress } from "@/types";

export interface UploadProgressBarProps {
  uploads: UploadProgress[];
  onCancel: (fileId: string) => void;
}

function getStatusSummary(uploads: UploadProgress[]): string {
  const total = uploads.length;
  if (total === 0) return "";

  const completed = uploads.filter((u) => u.status === "completed").length;
  const failed = uploads.filter((u) => u.status === "failed").length;
  const cancelled = uploads.filter((u) => u.status === "cancelled").length;

  if (completed + failed + cancelled === total) {
    if (failed > 0) {
      return `Completado con ${failed} error${failed > 1 ? "es" : ""}`;
    }
    return "Completado";
  }

  const inProgress = uploads.filter(
    (u) => u.status === "uploading" || u.status === "pending"
  ).length;

  return `Cargando ${total - inProgress - cancelled - failed} de ${total} archivos`;
}

function truncateFileName(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name;
  const ext = name.lastIndexOf(".") !== -1 ? name.slice(name.lastIndexOf(".")) : "";
  const nameWithoutExt = name.slice(0, name.length - ext.length);
  const truncatedLength = maxLength - ext.length - 3;
  if (truncatedLength <= 0) return name.slice(0, maxLength - 3) + "...";
  return nameWithoutExt.slice(0, truncatedLength) + "..." + ext;
}

function StatusIndicator({ upload }: { upload: UploadProgress }) {
  switch (upload.status) {
    case "pending":
      return (
        <span className="text-sm text-[#a1a1aa]">En espera...</span>
      );
    case "uploading":
      return (
        <span className="text-sm font-medium text-[#a855f7]">
          {upload.progress}%
        </span>
      );
    case "completed":
      return (
        <span className="text-sm font-medium text-green-400">✓</span>
      );
    case "failed":
      return (
        <span className="text-sm text-red-400">✗</span>
      );
    case "cancelled":
      return (
        <span className="text-sm text-[#a1a1aa]">Carga cancelada</span>
      );
    default:
      return null;
  }
}

export function UploadProgressBar({ uploads, onCancel }: UploadProgressBarProps) {
  if (uploads.length === 0) return null;

  const summary = getStatusSummary(uploads);

  return (
    <div className="w-full rounded-lg bg-[#1a1025] p-4 space-y-3">
      {/* Summary */}
      <p className="text-sm font-medium text-[#f5f5f5]">{summary}</p>

      {/* File list */}
      <ul className="space-y-2" role="list" aria-label="Lista de archivos en carga">
        {uploads.map((upload) => (
          <li
            key={upload.fileId}
            className="rounded-md bg-[#0f0a1a] p-3 space-y-2"
          >
            {/* Top row: file name, status, cancel button */}
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm text-[#f5f5f5] truncate flex-1"
                title={upload.fileName}
              >
                {truncateFileName(upload.fileName)}
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <StatusIndicator upload={upload} />

                {(upload.status === "pending" || upload.status === "uploading") && (
                  <button
                    type="button"
                    onClick={() => onCancel(upload.fileId)}
                    className="flex items-center justify-center w-5 h-5 rounded text-[#a1a1aa] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    aria-label={`Cancelar carga de ${upload.fileName}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar for uploading state */}
            {upload.status === "uploading" && (
              <div
                className="w-full h-2 rounded-full bg-[#1a1025] overflow-hidden"
                role="progressbar"
                aria-valuenow={upload.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de carga de ${upload.fileName}: ${upload.progress}%`}
              >
                <div
                  className="h-full rounded-full bg-[#a855f7] transition-all duration-300 ease-out"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}

            {/* Retry indicator */}
            {upload.retryCount > 0 &&
              (upload.status === "uploading" || upload.status === "pending") && (
                <p className="text-xs text-[#a1a1aa]">
                  Reintento {upload.retryCount}/3
                </p>
              )}

            {/* Error message for failed state */}
            {upload.status === "failed" && (
              <p className="text-xs text-red-400">
                {upload.error || "Error al cargar el archivo. Verifique su conexión e intente nuevamente"}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UploadProgressBar;
