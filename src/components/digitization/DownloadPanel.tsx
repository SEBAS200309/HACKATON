"use client";

import React from "react";

export interface DownloadPanelProps {
  isGenerating: boolean;
  docxDownloadUrl: string | null;
  xlsxDownloadUrl: string | null;
  filename: string;
  hasXlsxTemplate: boolean;
  error: string | null;
  onRetry: () => void;
  onGenerate: () => void;
}

export default function DownloadPanel({
  isGenerating,
  docxDownloadUrl,
  xlsxDownloadUrl,
  filename,
  hasXlsxTemplate,
  error,
  onRetry,
  onGenerate,
}: DownloadPanelProps) {
  // Loading state
  if (isGenerating) {
    return (
      <div
        className="rounded-lg border border-purple-500/20 bg-[#1a1025] p-6"
        role="status"
        aria-label="Generando documento"
      >
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-8 w-8 animate-spin text-purple-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-400">Generando documento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="rounded-lg border border-purple-500/20 bg-[#1a1025] p-6"
        role="alert"
        aria-label="Error al generar documento"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg
              className="h-6 w-6 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm text-red-400 text-center">
            Error al generar el documento. Intente nuevamente
          </p>
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg border border-purple-500 px-4 py-2 text-sm font-medium text-purple-400 transition-colors duration-150 hover:bg-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#1a1025]"
            aria-label="Reintentar generación de documento"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Success state (download links available)
  if (docxDownloadUrl) {
    return (
      <div
        className="rounded-lg border border-purple-500/20 bg-[#1a1025] p-6"
        aria-label="Documento generado"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Success icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <svg
              className="h-6 w-6 text-green-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Success heading */}
          <h3 className="text-base font-semibold text-white">
            Documento generado exitosamente
          </h3>

          {/* Filename display */}
          <p className="text-sm text-gray-400 break-all text-center">
            {filename}
          </p>

          {/* Download buttons */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={docxDownloadUrl}
              download={filename}
              className="inline-flex items-center justify-center rounded-lg bg-[#a855f7] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#9333ea] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#1a1025]"
              aria-label={`Descargar ${filename} en formato Word`}
            >
              <svg
                className="mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Descargar Word (.docx)
            </a>

            {hasXlsxTemplate && xlsxDownloadUrl && (
              <a
                href={xlsxDownloadUrl}
                download={filename.replace(/\.docx$/, ".xlsx")}
                className="inline-flex items-center justify-center rounded-lg border border-purple-500 px-4 py-2 text-sm font-medium text-purple-400 transition-colors duration-150 hover:bg-purple-500/10 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#1a1025]"
                aria-label={`Descargar ${filename.replace(/\.docx$/, ".xlsx")} en formato Excel`}
              >
                <svg
                  className="mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Descargar Excel (.xlsx)
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Initial state — prompt to generate
  return (
    <div
      className="rounded-lg border border-purple-500/20 bg-[#1a1025] p-6"
      aria-label="Panel de descarga"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
          <svg
            className="h-6 w-6 text-purple-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-400 text-center">
          Apruebe los resultados para generar el documento
        </p>
        <button
          onClick={onGenerate}
          className="inline-flex items-center justify-center rounded-lg bg-[#a855f7] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#9333ea] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-[#1a1025]"
          aria-label="Generar documento"
        >
          Generar documento
        </button>
      </div>
    </div>
  );
}
