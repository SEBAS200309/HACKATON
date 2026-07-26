"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { WorkspacePage, GeneratedFile, BatchGenerateResponse } from "@/types";

export interface BatchGeneratePanelProps {
  pages: WorkspacePage[];
  templateId: string;
  xlsxTemplateId?: string;
  assignedVariables: string[];
  onBatchComplete: (files: GeneratedFile[]) => void;
  onProgressUpdate: (progress: { current: number; total: number } | null) => void;
}

export default function BatchGeneratePanel({
  pages,
  templateId,
  xlsxTemplateId,
  assignedVariables,
  onBatchComplete,
  onProgressUpdate,
}: BatchGeneratePanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [errors, setErrors] = useState<Array<{ recordIndex: number; message: string }>>([]);
  const [showDownloads, setShowDownloads] = useState(false);

  // Calculate complete records: expand multi-record pages for XLSX
  const completeRecords = useMemo(() => {
    if (assignedVariables.length === 0) return [];

    const allRecords: Record<string, string>[] = [];

    for (const page of pages) {
      // Si la página tiene múltiples registros (modo XLSX columna), expandirlos
      if (page.records && page.records.length > 0) {
        for (const rec of page.records) {
          // Solo incluir registros donde todos los required tienen valor
          const allRequiredFilled = assignedVariables.every(
            (varName) => rec[varName] && rec[varName].trim() !== ""
          );
          if (allRequiredFilled) {
            allRecords.push(rec);
          }
        }
      } else if (page.ocrProcessed) {
        // Modo estándar: un registro por página
        const allFilled = assignedVariables.every(
          (varName) => page.record[varName] && page.record[varName].trim() !== ""
        );
        if (allFilled) {
          allRecords.push(page.record);
        }
      }
    }

    return allRecords;
  }, [pages, assignedVariables]);

  const isDisabled = completeRecords.length === 0 || isGenerating;

  const handleGenerate = useCallback(async () => {
    if (completeRecords.length === 0) return;

    setIsGenerating(true);
    setErrors([]);
    setGeneratedFiles([]);
    setShowDownloads(false);

    const total = completeRecords.length;

    // Simulate incremental progress while waiting for the response
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < total - 1) {
        currentProgress++;
        setProgressText(`Generando documento ${currentProgress} de ${total}...`);
        onProgressUpdate({ current: currentProgress, total });
      }
    }, 800);

    setProgressText(`Generando documento 1 de ${total}...`);
    onProgressUpdate({ current: 1, total });

    try {
      const response = await fetch("/api/documents/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          xlsxTemplateId,
          records: completeRecords,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error?.message ?? "Error al generar los documentos. Intente nuevamente.";
        setErrors([{ recordIndex: -1, message: errorMessage }]);
        setShowDownloads(false);
        return;
      }

      const data: BatchGenerateResponse = await response.json();

      // Map response files to GeneratedFile[]
      const files: GeneratedFile[] = data.files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        downloadUrl: f.downloadUrl,
        type: f.type,
      }));

      // Add zip as GeneratedFile
      if (data.zipDownloadUrl) {
        files.push({
          id: "zip-all",
          fileName: "documentos_lote.zip",
          downloadUrl: data.zipDownloadUrl,
          type: "zip",
        });
      }

      setGeneratedFiles(files);
      setErrors(data.errors ?? []);
      setShowDownloads(true);
      onBatchComplete(files);

      // Final progress
      setProgressText(`Generación completada: ${total} documentos.`);
      onProgressUpdate({ current: total, total });
    } catch {
      clearInterval(progressInterval);
      setErrors([
        {
          recordIndex: -1,
          message: "Error de conexión al generar los documentos. Verifique su red e intente nuevamente.",
        },
      ]);
    } finally {
      setIsGenerating(false);
      onProgressUpdate(null);
    }
  }, [completeRecords, templateId, xlsxTemplateId, onBatchComplete, onProgressUpdate]);

  const handleDownloadAll = useCallback(() => {
    const zipFile = generatedFiles.find((f) => f.type === "zip");
    if (zipFile) {
      const link = document.createElement("a");
      link.href = zipFile.downloadUrl;
      link.download = zipFile.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [generatedFiles]);

  const getFileIcon = (type: GeneratedFile["type"]) => {
    switch (type) {
      case "docx":
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
            W
          </span>
        );
      case "xlsx":
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
            X
          </span>
        );
      case "zip":
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">
            Z
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-[#1a1025] border border-purple-500/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#f5f5f5]">
          Generación por lotes
        </h3>
        <span className="text-xs text-[#a1a1aa]">
          {completeRecords.length} de {pages.length} registros completos
        </span>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isDisabled}
        aria-label={`Generar lote de ${completeRecords.length} registros`}
        className={`
          w-full flex items-center justify-center gap-2
          rounded-lg px-4 py-2.5 text-sm font-medium
          transition-colors duration-150
          ${isDisabled
            ? "bg-purple-500/20 text-purple-300/50 cursor-not-allowed"
            : "bg-[#a855f7] text-white hover:bg-[#9333ea] active:bg-[#7e22ce]"
          }
        `.trim()}
      >
        {isGenerating ? (
          <>
            {/* Spinner */}
            <svg
              className="animate-spin w-4 h-4"
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
            <span>{progressText}</span>
          </>
        ) : (
          `Generar lote (${completeRecords.length} registros)`
        )}
      </button>

      {/* Downloads panel */}
      {showDownloads && generatedFiles.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-[#f5f5f5]">
              Archivos generados
            </h4>
            <button
              type="button"
              onClick={handleDownloadAll}
              className="
                flex items-center gap-1.5
                rounded px-3 py-1.5 text-xs font-medium
                bg-[#a855f7] text-white
                hover:bg-[#9333ea] active:bg-[#7e22ce]
                transition-colors duration-150
              "
              aria-label="Descargar todos los archivos como ZIP"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
                />
              </svg>
              Descargar todo
            </button>
          </div>

          {/* File list */}
          <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto" role="list">
            {generatedFiles
              .filter((f) => f.type !== "zip")
              .map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 bg-[#0f0a1a] border border-purple-500/10"
                >
                  {getFileIcon(file.type)}
                  <a
                    href={file.downloadUrl}
                    download={file.fileName}
                    className="flex-1 text-xs text-[#f5f5f5] hover:text-[#a855f7] truncate transition-colors"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </a>
                  <svg
                    className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
                    />
                  </svg>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {errors.map((err, idx) => (
            <p
              key={`error-${idx}`}
              className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 border border-red-400/20"
              role="alert"
            >
              {err.recordIndex >= 0
                ? `Error al generar documento para el registro ${err.recordIndex + 1}. Los demás documentos se generaron correctamente.`
                : err.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
