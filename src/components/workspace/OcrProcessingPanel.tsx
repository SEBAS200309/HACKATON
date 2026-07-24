"use client";

import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { AreaOfInterest, OcrResult } from "@/types";

/**
 * OcrProcessingPanel — Procesa OCR por lotes para todas las páginas del workspace.
 * Muestra skeleton UI durante procesamiento y progreso por página.
 */
export default function OcrProcessingPanel() {
  const pages = useAppStore((s) => s.pages);
  const setPageOcrResults = useAppStore((s) => s.setPageOcrResults);
  const addToast = useAppStore((s) => s.addToast);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  // Pages that have at least one zone defined
  const pagesWithZones = pages.filter((p) => p.zones.length > 0);
  const hasZones = pagesWithZones.length > 0;

  // Check if all pages with zones are already processed
  const allProcessed = pagesWithZones.length > 0 && pagesWithZones.every((p) => p.ocrProcessed);

  const handleProcessOcr = useCallback(async () => {
    if (!hasZones || isProcessing) return;

    setIsProcessing(true);
    setErrors([]);
    setCurrentPageIndex(0);
    setTotalToProcess(pagesWithZones.length);

    const newErrors: string[] = [];

    for (let i = 0; i < pagesWithZones.length; i++) {
      const page = pagesWithZones[i];
      setCurrentPageIndex(i + 1);

      // Set page status to processing
      useAppStore.setState((state) => ({
        pages: state.pages.map((p) =>
          p.id === page.id ? { ...p, status: "processing" as const } : p
        ),
      }));

      try {
        // Map zones to AreaOfInterest format for the API
        const areas: AreaOfInterest[] = page.zones.map((zone) => ({
          id: zone.id,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          variableName: zone.variableName,
          color: zone.color,
        }));

        const response = await fetch("/api/ocr/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentKey: page.imageS3Key,
            areas,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.error?.message ??
            `Error al procesar página ${page.pageNumber}`;
          newErrors.push(errorMessage);

          // Set page status to error
          useAppStore.setState((state) => ({
            pages: state.pages.map((p) =>
              p.id === page.id ? { ...p, status: "error" as const } : p
            ),
          }));
          continue;
        }

        const data = await response.json();
        const results: OcrResult[] = data.results ?? [];

        // Populate page record with OCR results
        setPageOcrResults(page.id, results);
      } catch {
        newErrors.push(`Error de conexión al procesar página ${page.pageNumber}`);

        // Set page status to error
        useAppStore.setState((state) => ({
          pages: state.pages.map((p) =>
            p.id === page.id ? { ...p, status: "error" as const } : p
          ),
        }));
      }
    }

    setErrors(newErrors);
    setIsProcessing(false);

    if (newErrors.length === 0) {
      addToast({ type: "success", message: "OCR completado exitosamente para todas las páginas" });
    } else if (newErrors.length < pagesWithZones.length) {
      addToast({ type: "warning", message: `OCR completado con ${newErrors.length} error(es)` });
    } else {
      addToast({ type: "error", message: "Error al procesar OCR en todas las páginas" });
    }
  }, [hasZones, isProcessing, pagesWithZones, setPageOcrResults, addToast]);

  return (
    <div className="space-y-3">
      {/* Process button */}
      <button
        type="button"
        onClick={handleProcessOcr}
        disabled={!hasZones || isProcessing || allProcessed}
        className={`
          w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150
          ${
            !hasZones || isProcessing || allProcessed
              ? "bg-purple-500/20 text-[#a1a1aa] cursor-not-allowed"
              : "bg-[#a855f7] text-white hover:bg-[#9333ea] active:bg-[#7e22ce]"
          }
        `}
        aria-label="Procesar OCR en todas las páginas"
      >
        {isProcessing
          ? "Procesando..."
          : allProcessed
          ? "✓ OCR completado"
          : "Procesar OCR"}
      </button>

      {/* Hint when no zones */}
      {!hasZones && !isProcessing && (
        <p className="text-xs text-[#a1a1aa]">
          Defina zonas en al menos una página para habilitar el procesamiento OCR.
        </p>
      )}

      {/* Progress indicator */}
      {isProcessing && (
        <div className="space-y-2">
          <p className="text-xs text-[#a1a1aa]">
            Procesando página {currentPageIndex} de {totalToProcess}...
          </p>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[#0f0a1a] overflow-hidden">
            <div
              className="h-full bg-[#a855f7] rounded-full transition-all duration-300"
              style={{
                width: `${(currentPageIndex / totalToProcess) * 100}%`,
              }}
            />
          </div>

          {/* Skeleton rows */}
          <div className="space-y-1.5 mt-3">
            {pagesWithZones.map((page, idx) => (
              <div
                key={page.id}
                className={`
                  flex items-center gap-2 rounded px-2 py-1.5 border border-purple-500/10
                  ${idx < currentPageIndex ? "bg-[#0f0a1a]" : "bg-[#1a1025]/50"}
                `}
              >
                {/* Status indicator */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    idx < currentPageIndex - 1
                      ? "bg-green-500"
                      : idx === currentPageIndex - 1
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-[#a1a1aa]/30"
                  }`}
                />

                {/* Page label or skeleton */}
                {idx < currentPageIndex ? (
                  <span className="text-xs text-[#f5f5f5]">
                    Pág. {page.pageNumber}
                  </span>
                ) : (
                  <div className="flex-1 flex gap-2">
                    <div className="h-3 w-12 rounded bg-purple-500/10 animate-pulse" />
                    <div className="h-3 flex-1 rounded bg-purple-500/10 animate-pulse" />
                  </div>
                )}

                {/* Result status */}
                {idx < currentPageIndex - 1 && (
                  <span className="text-[10px] text-green-400 ml-auto">✓</span>
                )}
                {idx === currentPageIndex - 1 && (
                  <span className="text-[10px] text-yellow-400 ml-auto animate-pulse">
                    ...
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && !isProcessing && (
        <div className="space-y-1">
          {errors.map((error, idx) => (
            <p key={idx} className="text-xs text-red-400">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
