"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { AreaOfInterest } from "@/types";

export interface CanvasOverlayProps {
  imageUrl: string;
  areas: AreaOfInterest[];
  selectedAreaId: string | null;
  onAreaCreated: (area: Omit<AreaOfInterest, "id" | "variableName">) => void;
  onAreaUpdated: (id: string, updates: Partial<AreaOfInterest>) => void;
  onAreaDeleted: (id: string) => void;
  onAreaSelected: (id: string | null) => void;
}

type InteractionMode = "idle" | "drawing" | "moving" | "resizing";
type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | null;

const MIN_AREA_SIZE_PX = 10;
const HANDLE_SIZE = 8;

export default function CanvasOverlay({
  imageUrl,
  areas,
  selectedAreaId,
  onAreaCreated,
  onAreaUpdated,
  onAreaDeleted,
  onAreaSelected,
}: CanvasOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [drawCurrent, setDrawCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);

  // Convert normalized (0-1) coordinates to pixel coordinates
  const toPixel = useCallback(
    (nx: number, ny: number) => ({
      x: nx * canvasSize.width,
      y: ny * canvasSize.height,
    }),
    [canvasSize]
  );

  // Convert pixel coordinates to normalized (0-1)
  const toNormalized = useCallback(
    (px: number, py: number) => ({
      x: canvasSize.width > 0 ? px / canvasSize.width : 0,
      y: canvasSize.height > 0 ? py / canvasSize.height : 0,
    }),
    [canvasSize]
  );

  // Get mouse/touch position relative to canvas
  const getCanvasPosition = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // Find area under cursor (pixel coords)
  const findAreaAtPoint = useCallback(
    (px: number, py: number): AreaOfInterest | null => {
      // Check in reverse order (top-most first)
      for (let i = areas.length - 1; i >= 0; i--) {
        const area = areas[i];
        const topLeft = toPixel(area.x, area.y);
        const w = area.width * canvasSize.width;
        const h = area.height * canvasSize.height;
        if (
          px >= topLeft.x &&
          px <= topLeft.x + w &&
          py >= topLeft.y &&
          py <= topLeft.y + h
        ) {
          return area;
        }
      }
      return null;
    },
    [areas, canvasSize, toPixel]
  );

  // Find resize handle at point for selected area
  const findHandleAtPoint = useCallback(
    (px: number, py: number): ResizeHandle => {
      if (!selectedAreaId) return null;
      const area = areas.find((a) => a.id === selectedAreaId);
      if (!area) return null;

      const topLeft = toPixel(area.x, area.y);
      const w = area.width * canvasSize.width;
      const h = area.height * canvasSize.height;
      const half = HANDLE_SIZE / 2;

      const handles: { handle: ResizeHandle; cx: number; cy: number }[] = [
        { handle: "nw", cx: topLeft.x, cy: topLeft.y },
        { handle: "n", cx: topLeft.x + w / 2, cy: topLeft.y },
        { handle: "ne", cx: topLeft.x + w, cy: topLeft.y },
        { handle: "e", cx: topLeft.x + w, cy: topLeft.y + h / 2 },
        { handle: "se", cx: topLeft.x + w, cy: topLeft.y + h },
        { handle: "s", cx: topLeft.x + w / 2, cy: topLeft.y + h },
        { handle: "sw", cx: topLeft.x, cy: topLeft.y + h },
        { handle: "w", cx: topLeft.x, cy: topLeft.y + h / 2 },
      ];

      for (const { handle, cx, cy } of handles) {
        if (
          px >= cx - half - 2 &&
          px <= cx + half + 2 &&
          py >= cy - half - 2 &&
          py <= cy + half + 2
        ) {
          return handle;
        }
      }
      return null;
    },
    [selectedAreaId, areas, canvasSize, toPixel]
  );

  // Handle image load and canvas sizing
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const containerWidth = container.clientWidth;
    const aspectRatio = img.naturalHeight / img.naturalWidth;
    const displayWidth = containerWidth;
    const displayHeight = containerWidth * aspectRatio;

    setCanvasSize({ width: displayWidth, height: displayHeight });
    setImageLoaded(true);
  }, []);

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (imageRef.current && imageRef.current.naturalWidth > 0) {
        handleImageLoad();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [handleImageLoad]);

  // Draw all areas on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw existing areas
    for (const area of areas) {
      const topLeft = toPixel(area.x, area.y);
      const w = area.width * canvasSize.width;
      const h = area.height * canvasSize.height;
      const isSelected = area.id === selectedAreaId;

      // Fill with semi-transparent color
      ctx.fillStyle = area.color + "20";
      ctx.fillRect(topLeft.x, topLeft.y, w, h);

      // Border
      ctx.strokeStyle = area.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [5, 3]);
      ctx.strokeRect(topLeft.x, topLeft.y, w, h);
      ctx.setLineDash([]);

      // Label background
      const label = area.variableName || "Sin nombre";
      ctx.font = "12px Inter, system-ui, sans-serif";
      const textMetrics = ctx.measureText(label);
      const labelPadding = 4;
      const labelHeight = 18;
      const labelWidth = textMetrics.width + labelPadding * 2;

      ctx.fillStyle = area.color + "CC";
      ctx.fillRect(
        topLeft.x,
        topLeft.y - labelHeight - 2,
        labelWidth,
        labelHeight
      );

      // Label text
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(
        label,
        topLeft.x + labelPadding,
        topLeft.y - labelHeight / 2 - 2
      );

      // Draw resize handles for selected area
      if (isSelected) {
        const handles = [
          { x: topLeft.x, y: topLeft.y },
          { x: topLeft.x + w / 2, y: topLeft.y },
          { x: topLeft.x + w, y: topLeft.y },
          { x: topLeft.x + w, y: topLeft.y + h / 2 },
          { x: topLeft.x + w, y: topLeft.y + h },
          { x: topLeft.x + w / 2, y: topLeft.y + h },
          { x: topLeft.x, y: topLeft.y + h },
          { x: topLeft.x, y: topLeft.y + h / 2 },
        ];
        for (const handle of handles) {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = area.color;
          ctx.lineWidth = 2;
          ctx.fillRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
          ctx.strokeRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
        }
      }
    }

    // Draw current drawing rectangle
    if (mode === "drawing" && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);

      ctx.fillStyle = "#a855f720";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [areas, selectedAreaId, canvasSize, imageLoaded, mode, drawStart, drawCurrent, toPixel]);

  // Keyboard handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAreaId) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        onAreaDeleted(selectedAreaId);
      }
      if (e.key === "Escape") {
        onAreaSelected(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedAreaId, onAreaDeleted, onAreaSelected]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCanvasPosition(e);

    // Check resize handle first
    const handle = findHandleAtPoint(pos.x, pos.y);
    if (handle) {
      setMode("resizing");
      setActiveHandle(handle);
      setDrawStart(pos);
      return;
    }

    // Check if clicking on an existing area
    const clickedArea = findAreaAtPoint(pos.x, pos.y);
    if (clickedArea) {
      onAreaSelected(clickedArea.id);
      setMode("moving");
      const topLeft = toPixel(clickedArea.x, clickedArea.y);
      setDragOffset({ x: pos.x - topLeft.x, y: pos.y - topLeft.y });
      return;
    }

    // Start drawing new area
    onAreaSelected(null);
    setMode("drawing");
    setDrawStart(pos);
    setDrawCurrent(pos);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === "idle") return;
    e.preventDefault();
    const pos = getCanvasPosition(e);

    if (mode === "drawing") {
      setDrawCurrent(pos);
      return;
    }

    if (mode === "moving" && selectedAreaId && dragOffset) {
      const area = areas.find((a) => a.id === selectedAreaId);
      if (!area) return;
      const w = area.width * canvasSize.width;
      const h = area.height * canvasSize.height;

      let newX = pos.x - dragOffset.x;
      let newY = pos.y - dragOffset.y;

      // Clamp to canvas bounds
      newX = Math.max(0, Math.min(canvasSize.width - w, newX));
      newY = Math.max(0, Math.min(canvasSize.height - h, newY));

      const normalized = toNormalized(newX, newY);
      onAreaUpdated(selectedAreaId, { x: normalized.x, y: normalized.y });
      return;
    }

    if (mode === "resizing" && selectedAreaId && activeHandle && drawStart) {
      const area = areas.find((a) => a.id === selectedAreaId);
      if (!area) return;

      const topLeft = toPixel(area.x, area.y);
      const w = area.width * canvasSize.width;
      const h = area.height * canvasSize.height;

      let newX = topLeft.x;
      let newY = topLeft.y;
      let newW = w;
      let newH = h;

      // Adjust based on handle
      if (activeHandle.includes("w")) {
        newW = topLeft.x + w - pos.x;
        newX = pos.x;
      }
      if (activeHandle.includes("e")) {
        newW = pos.x - topLeft.x;
      }
      if (activeHandle.includes("n")) {
        newH = topLeft.y + h - pos.y;
        newY = pos.y;
      }
      if (activeHandle.includes("s")) {
        newH = pos.y - topLeft.y;
      }

      // Enforce minimum size
      if (newW < MIN_AREA_SIZE_PX) {
        if (activeHandle.includes("w")) {
          newX = topLeft.x + w - MIN_AREA_SIZE_PX;
        }
        newW = MIN_AREA_SIZE_PX;
      }
      if (newH < MIN_AREA_SIZE_PX) {
        if (activeHandle.includes("n")) {
          newY = topLeft.y + h - MIN_AREA_SIZE_PX;
        }
        newH = MIN_AREA_SIZE_PX;
      }

      // Clamp to canvas
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      if (newX + newW > canvasSize.width) newW = canvasSize.width - newX;
      if (newY + newH > canvasSize.height) newH = canvasSize.height - newY;

      const normalizedPos = toNormalized(newX, newY);
      onAreaUpdated(selectedAreaId, {
        x: normalizedPos.x,
        y: normalizedPos.y,
        width: canvasSize.width > 0 ? newW / canvasSize.width : 0,
        height: canvasSize.height > 0 ? newH / canvasSize.height : 0,
      });
    }
  };

  const handlePointerUp = () => {
    if (mode === "drawing" && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);

      // Reject rectangles smaller than minimum size
      if (w >= MIN_AREA_SIZE_PX && h >= MIN_AREA_SIZE_PX) {
        const normalized = toNormalized(x, y);
        onAreaCreated({
          x: normalized.x,
          y: normalized.y,
          width: canvasSize.width > 0 ? w / canvasSize.width : 0,
          height: canvasSize.height > 0 ? h / canvasSize.height : 0,
          color: "", // Will be assigned by parent
        });
      }
    }

    setMode("idle");
    setDrawStart(null);
    setDrawCurrent(null);
    setDragOffset(null);
    setActiveHandle(null);
  };

  // Cursor style based on interaction
  const getCursorStyle = (): string => {
    if (mode === "drawing") return "crosshair";
    if (mode === "moving") return "grabbing";
    if (mode === "resizing") {
      if (activeHandle === "nw" || activeHandle === "se") return "nwse-resize";
      if (activeHandle === "ne" || activeHandle === "sw") return "nesw-resize";
      if (activeHandle === "n" || activeHandle === "s") return "ns-resize";
      if (activeHandle === "e" || activeHandle === "w") return "ew-resize";
    }
    return "crosshair";
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      role="application"
      aria-label="Editor de áreas del documento"
    >
      {/* Document image - using img intentionally for canvas manipulation, next/image not suitable */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Documento para segmentación"
        className="w-full h-auto block"
        onLoad={handleImageLoad}
        draggable={false}
        style={{
          width: canvasSize.width > 0 ? `${canvasSize.width}px` : "100%",
          height: canvasSize.height > 0 ? `${canvasSize.height}px` : "auto",
        }}
      />

      {/* Canvas overlay */}
      {imageLoaded && (
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="absolute top-0 left-0"
          style={{ cursor: getCursorStyle() }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          aria-hidden="true"
        />
      )}

      {!imageLoaded && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>Cargando documento...</p>
        </div>
      )}
    </div>
  );
}
