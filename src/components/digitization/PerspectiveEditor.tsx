"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { Point } from "@/types";
import {
  detectDocumentCorners,
  applyPerspectiveTransform,
} from "@/utils/perspectiveCorrection";

export interface PerspectiveEditorProps {
  imageBlob: Blob;
  onAccept: (correctedBlob: Blob, correctedCanvas: HTMLCanvasElement) => void;
  onReject: () => void;
  onSkip?: () => void;
}

type Corners = [Point, Point, Point, Point];

type EditorView = "adjust" | "preview";

const CORNER_RADIUS = 12;
const CORNER_HIT_RADIUS = 24;
const MARGIN_PERCENT = 0.05;

export default function PerspectiveEditor({
  imageBlob,
  onAccept,
  onReject,
  onSkip,
}: PerspectiveEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [view, setView] = useState<EditorView>("adjust");
  const [correctedCanvas, setCorrectedCanvas] =
    useState<HTMLCanvasElement | null>(null);
  const [correctedBlob, setCorrectedBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load image and detect corners on mount
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }

      imageRef.current = img;

      // El canvas puede no existir aún si estamos en el render de loading.
      // Guardamos la imagen en el ref y setLoading(false) para que el canvas se monte.
      // Luego el segundo effect (drawOverlay) se encargará de dibujar.
      setLoading(false);
    };

    img.onerror = () => {
      if (cancelled) return;
      setLoading(false);
      setFallbackMessage("Error al cargar la imagen.");
    };

    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [imageBlob]);

  // Once loading is false and canvas is mounted, draw the image and detect corners
  useEffect(() => {
    if (loading || !imageRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = imageRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Attempt auto-detection
    const detected = detectDocumentCorners(imageData);

    if (detected && detected.length === 4) {
      setCorners(detected as Corners);
      setAutoDetected(true);
      setFallbackMessage(null);
    } else {
      // Fallback: image corners with 5% margin
      const w = canvas.width;
      const h = canvas.height;
      const mx = w * MARGIN_PERCENT;
      const my = h * MARGIN_PERCENT;
      const fallbackCorners: Corners = [
        { x: mx, y: my }, // TL
        { x: w - mx, y: my }, // TR
        { x: w - mx, y: h - my }, // BR
        { x: mx, y: h - my }, // BL
      ];
      setCorners(fallbackCorners);
      setAutoDetected(false);
      setFallbackMessage(
        "No se detectaron bordes automáticamente. Ajuste los puntos manualmente."
      );
    }
  }, [loading]);

  // Draw overlay (corners + guide lines) whenever corners change
  useEffect(() => {
    if (view !== "adjust" || !corners || !imageRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw guide lines
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Semi-transparent fill
    ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
    ctx.fill();

    // Draw corner points
    corners.forEach((corner) => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, CORNER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = autoDetected ? "#a855f7" : "#c084fc";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [corners, view, autoDetected]);

  // Get canvas-relative coordinates from mouse/touch event
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  // Find which corner is near the point
  const findNearCorner = useCallback(
    (point: Point): number | null => {
      if (!corners) return null;

      const canvas = canvasRef.current;
      if (!canvas) return null;

      // Scale hit radius to canvas coordinate space
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const hitRadius = CORNER_HIT_RADIUS * scaleX;

      for (let i = 0; i < corners.length; i++) {
        const dx = corners[i].x - point.x;
        const dy = corners[i].y - point.y;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
          return i;
        }
      }
      return null;
    },
    [corners]
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (view !== "adjust") return;
      const point = getCanvasPoint(e);
      if (!point) return;

      const idx = findNearCorner(point);
      if (idx !== null) {
        setDraggingIndex(idx);
        e.preventDefault();
      }
    },
    [view, getCanvasPoint, findNearCorner]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (draggingIndex === null || !corners) return;
      e.preventDefault();

      const point = getCanvasPoint(e);
      if (!point) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Clamp to canvas bounds
      const clampedX = Math.max(0, Math.min(canvas.width, point.x));
      const clampedY = Math.max(0, Math.min(canvas.height, point.y));

      const newCorners = [...corners] as Corners;
      newCorners[draggingIndex] = { x: clampedX, y: clampedY };
      setCorners(newCorners);
    },
    [draggingIndex, corners, getCanvasPoint]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  // Apply perspective transform
  const handleApply = useCallback(async () => {
    if (!corners || !canvasRef.current) return;

    setProcessing(true);

    // Run transform in next tick to let UI update
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const sourceCanvas = canvasRef.current;
      // Use the longer side as the output dimension for better quality
      const maxDim = Math.max(sourceCanvas.width, sourceCanvas.height);
      const outputWidth = Math.min(maxDim, 2480); // A4 at 300dpi width
      const outputHeight = Math.min(
        Math.round(outputWidth * 1.414),
        maxDim * 1.414
      ); // A4 ratio

      const result = applyPerspectiveTransform(
        sourceCanvas,
        corners,
        outputWidth,
        outputHeight
      );

      setCorrectedCanvas(result.correctedCanvas);
      setCorrectedBlob(result.correctedBlob);
      setView("preview");
    } catch {
      setFallbackMessage("Error al aplicar la corrección de perspectiva.");
    } finally {
      setProcessing(false);
    }
  }, [corners]);

  // Accept correction
  const handleAccept = useCallback(() => {
    if (correctedBlob && correctedCanvas) {
      onAccept(correctedBlob, correctedCanvas);
    }
  }, [correctedBlob, correctedCanvas, onAccept]);

  // Reject: go back to adjustment view (preserving corners)
  const handleReject = useCallback(() => {
    // Restaurar dimensiones del canvas antes de cambiar de vista
    if (imageRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = imageRef.current.naturalWidth;
      canvas.height = imageRef.current.naturalHeight;
    }
    setView("adjust");
    setCorrectedCanvas(null);
    setCorrectedBlob(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[300px]">
        <p className="text-sm text-[#a1a1aa]">Procesando imagen...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Fallback message */}
      {fallbackMessage && view === "adjust" && (
        <div
          className="rounded-lg bg-[#1a1025] border border-[#a855f7]/30 px-4 py-3 text-sm text-[#a1a1aa]"
          role="alert"
        >
          {fallbackMessage}
        </div>
      )}

      {/* Adjust view: canvas with draggable corners */}
      {view === "adjust" && (
        <>
          <div className="relative w-full overflow-hidden rounded-lg border-2 border-gray-700 bg-black">
            <canvas
              ref={canvasRef}
              className="w-full h-auto cursor-crosshair touch-none"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              aria-label="Editor de perspectiva - arrastre los puntos para ajustar"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleApply}
              variant="primary"
              size="md"
              loading={processing}
              disabled={!corners}
            >
              Aplicar
            </Button>
            <Button onClick={onReject} variant="secondary" size="md">
              Cancelar
            </Button>
            {onSkip && (
              <Button onClick={onSkip} variant="secondary" size="sm">
                Omitir
              </Button>
            )}
          </div>
        </>
      )}

      {/* Preview view: only show corrected result */}
      {view === "preview" && correctedCanvas && (
        <>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-[#a1a1aa] uppercase tracking-wide">
              Resultado de la corrección
            </span>
            <div className="w-full rounded-lg border border-[#a855f7]/50 overflow-hidden bg-black">
              <img
                src={correctedCanvas.toDataURL()}
                alt="Imagen con perspectiva corregida"
                className="w-full h-auto"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleAccept} variant="primary" size="md">
              Aceptar
            </Button>
            <Button onClick={handleReject} variant="secondary" size="md">
              Rechazar
            </Button>
            {onSkip && (
              <Button onClick={onSkip} variant="secondary" size="sm">
                Omitir
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
