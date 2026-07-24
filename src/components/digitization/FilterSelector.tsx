"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { applyFilter } from "@/utils/imageFilters";
import type { FilterType } from "@/types";

export interface FilterSelectorProps {
  sourceCanvas: HTMLCanvasElement;
  onConfirm: (filteredBlob: Blob, filteredCanvas: HTMLCanvasElement) => void;
  onCancel?: () => void;
}

interface FilterOption {
  type: FilterType;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { type: "none", label: "Original" },
  { type: "grayscale", label: "Escala de grises" },
  { type: "whiteEnhance", label: "Mejora de blancos" },
  { type: "grayscaleWhiteEnhance", label: "Escala de grises + blancos" },
];

/** Max thumbnail dimension for performance */
const THUMBNAIL_MAX_SIZE = 150;

/**
 * Downscales a canvas to a thumbnail for quick preview generation.
 */
function createThumbnailCanvas(source: HTMLCanvasElement, maxSize: number): HTMLCanvasElement {
  const ratio = Math.min(maxSize / source.width, maxSize / source.height, 1);
  const width = Math.round(source.width * ratio);
  const height = Math.round(source.height * ratio);

  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = width;
  thumbCanvas.height = height;

  const ctx = thumbCanvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(source, 0, 0, width, height);
  }

  return thumbCanvas;
}

export default function FilterSelector({
  sourceCanvas,
  onConfirm,
  onCancel,
}: FilterSelectorProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("none");
  const [thumbnails, setThumbnails] = useState<Record<FilterType, string>>({} as Record<FilterType, string>);
  const [fullPreviewUrl, setFullPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingThumbnails, setLoadingThumbnails] = useState(true);

  // Ref to track current full-preview generation to avoid stale updates
  const previewGenRef = useRef(0);

  // Generate thumbnails on mount
  useEffect(() => {
    let cancelled = false;

    const generateThumbnails = async () => {
      setLoadingThumbnails(true);
      const thumbCanvas = createThumbnailCanvas(sourceCanvas, THUMBNAIL_MAX_SIZE);
      const results: Partial<Record<FilterType, string>> = {};

      for (const option of FILTER_OPTIONS) {
        if (cancelled) return;
        try {
          const { canvas } = await applyFilter(thumbCanvas, option.type);
          results[option.type] = canvas.toDataURL("image/jpeg", 0.7);
        } catch {
          // If thumbnail generation fails, use empty placeholder
          results[option.type] = "";
        }
      }

      if (!cancelled) {
        setThumbnails(results as Record<FilterType, string>);
        setLoadingThumbnails(false);
      }
    };

    generateThumbnails();

    return () => {
      cancelled = true;
    };
  }, [sourceCanvas]);

  // Generate full-size preview when filter selection changes
  useEffect(() => {
    let cancelled = false;
    const genId = ++previewGenRef.current;

    const generateFullPreview = async () => {
      try {
        const { canvas } = await applyFilter(sourceCanvas, selectedFilter);
        if (!cancelled && genId === previewGenRef.current) {
          setFullPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
          setError(null);
        }
      } catch {
        if (!cancelled && genId === previewGenRef.current) {
          setError(
            "Error al aplicar el filtro. La imagen es demasiado grande para procesar en el navegador"
          );
        }
      }
    };

    generateFullPreview();

    return () => {
      cancelled = true;
    };
  }, [sourceCanvas, selectedFilter]);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    setProcessing(true);
    setError(null);

    try {
      const { blob, canvas } = await applyFilter(sourceCanvas, selectedFilter);
      onConfirm(blob, canvas);
    } catch {
      setError(
        "Error al aplicar el filtro. La imagen es demasiado grande para procesar en el navegador"
      );
    } finally {
      setProcessing(false);
    }
  }, [sourceCanvas, selectedFilter, onConfirm]);

  return (
    <div className="flex flex-col gap-4 w-full" role="region" aria-label="Selector de filtro">
      {/* Full-size preview */}
      <div className="w-full rounded-lg overflow-hidden border border-gray-700 bg-[#1a1025] min-h-[200px] flex items-center justify-center">
        {fullPreviewUrl ? (
          <img
            src={fullPreviewUrl}
            alt={`Vista previa con filtro: ${FILTER_OPTIONS.find((o) => o.type === selectedFilter)?.label}`}
            className="w-full h-auto max-h-[400px] object-contain"
          />
        ) : (
          <p className="text-sm text-[#a1a1aa]">Generando vista previa...</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Filter options grid (2x2) */}
      <div
        className="grid grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Opciones de filtro"
      >
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilter === option.type;
          return (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedFilter(option.type)}
              className={`
                flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-colors duration-150
                bg-[#1a1025] hover:bg-[#251535]
                ${isSelected ? "border-[#a855f7]" : "border-gray-700"}
              `}
            >
              <div className="w-full aspect-[4/3] rounded overflow-hidden bg-[#0f0a1a] flex items-center justify-center">
                {loadingThumbnails || !thumbnails[option.type] ? (
                  <span className="text-xs text-[#a1a1aa]">...</span>
                ) : (
                  <img
                    src={thumbnails[option.type]}
                    alt={`Miniatura: ${option.label}`}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isSelected ? "text-[#a855f7]" : "text-[#f5f5f5]"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-end mt-2">
        {onCancel && (
          <Button variant="secondary" size="md" onClick={onCancel} disabled={processing}>
            Volver
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          loading={processing}
          disabled={processing}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );
}
