"use client";

import React, { useState, useCallback } from "react";
import type { WorkspacePage } from "@/types";

export interface PageThumbnailListProps {
  pages: WorkspacePage[];
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
}

const statusColors: Record<WorkspacePage["status"], string> = {
  pending: "bg-gray-400",
  processing: "bg-yellow-400",
  completed: "bg-green-400",
  error: "bg-red-400",
};

const statusLabels: Record<WorkspacePage["status"], string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completada",
  error: "Error",
};

export default function PageThumbnailList({
  pages,
  currentPageId,
  onSelectPage,
  onAddPage,
  onRemovePage,
  onReorderPages,
}: PageThumbnailListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragIndex;
      setDragIndex(null);
      setDropTargetIndex(null);

      if (fromIndex !== null && fromIndex !== toIndex) {
        onReorderPages(fromIndex, toIndex);
      }
    },
    [dragIndex, onReorderPages]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleRemovePage = useCallback(
    (pageId: string, pageNumber: number) => {
      const confirmed = window.confirm(
        `¿Está seguro de eliminar la página ${pageNumber}?`
      );
      if (confirmed) {
        onRemovePage(pageId);
      }
    },
    [onRemovePage]
  );

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      role="list"
      aria-label="Lista de páginas"
    >
      {/* Thumbnails */}
      <div className="flex-1 space-y-2 p-1">
        {pages.length === 0 ? (
          <p className="text-xs text-[#a1a1aa] text-center py-4">
            No hay páginas capturadas aún.
          </p>
        ) : (
          pages.map((page, index) => {
            const isActive = page.id === currentPageId;
            const isDragging = dragIndex === index;
            const isDropTarget = dropTargetIndex === index;

            return (
              <div
                key={page.id}
                role="listitem"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectPage(page.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPage(page.id);
                  }
                }}
                tabIndex={0}
                aria-label={`Página ${page.pageNumber} — ${statusLabels[page.status]}`}
                aria-current={isActive ? "true" : undefined}
                className={`
                  group relative rounded-lg border p-2 cursor-pointer
                  transition-all duration-150 select-none
                  ${isActive
                    ? "border-[#a855f7] bg-[#a855f7]/10"
                    : "border-purple-500/20 hover:border-purple-500/40 bg-[#0f0a1a]"
                  }
                  ${isDragging ? "opacity-50" : ""}
                  ${isDropTarget && !isDragging
                    ? "border-[#a855f7] border-dashed"
                    : ""
                  }
                `.trim()}
              >
                {/* Drop indicator line */}
                {isDropTarget && !isDragging && (
                  <div className="absolute -top-1 left-2 right-2 h-0.5 bg-[#a855f7] rounded-full" />
                )}

                {/* Header: page number + status + delete */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${statusColors[page.status]}`}
                      title={statusLabels[page.status]}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-[#f5f5f5]">
                      Pág. {page.pageNumber}
                    </span>
                  </div>

                  {/* Delete button — visible on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePage(page.id, page.pageNumber);
                    }}
                    className="
                      opacity-0 group-hover:opacity-100
                      transition-opacity duration-150
                      w-5 h-5 flex items-center justify-center
                      rounded text-[#a1a1aa] hover:text-red-400 hover:bg-red-400/10
                    "
                    aria-label={`Eliminar página ${page.pageNumber}`}
                    title="Eliminar página"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Thumbnail image */}
                <div className="w-full h-20 rounded bg-[#1a1025] overflow-hidden flex items-center justify-center">
                  {page.imageUrl ? (
                    <img
                      src={page.imageUrl}
                      alt={`Miniatura página ${page.pageNumber}`}
                      className="max-h-[80px] w-auto object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-[10px] text-[#a1a1aa]">
                      Sin imagen
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add page button */}
      <div className="p-2 border-t border-purple-500/20">
        <button
          type="button"
          onClick={onAddPage}
          className="
            w-full flex items-center justify-center gap-1.5
            rounded-lg border border-dashed border-purple-500/30
            px-3 py-2 text-xs font-medium
            text-[#a855f7] hover:text-[#9333ea]
            hover:border-[#9333ea] hover:bg-[#a855f7]/5
            transition-colors duration-150
          "
          aria-label="Agregar página"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Agregar página
        </button>
      </div>
    </div>
  );
}
