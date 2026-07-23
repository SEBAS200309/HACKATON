"use client";

import React from "react";
import type { AreaOfInterest } from "@/types";
import Button from "@/components/ui/Button";

export interface AreaListProps {
  areas: AreaOfInterest[];
  selectedAreaId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AreaList({
  areas,
  selectedAreaId,
  onSelect,
  onDelete,
}: AreaListProps) {
  if (areas.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400 border border-dashed border-gray-700 rounded-lg">
        <p className="text-sm">
          No hay áreas definidas. Dibuje un rectángulo sobre el documento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="listbox" aria-label="Lista de áreas definidas">
      {areas.map((area) => {
        const isSelected = area.id === selectedAreaId;
        const coordSummary = `(${(area.x * 100).toFixed(0)}%, ${(area.y * 100).toFixed(0)}%) ${(area.width * 100).toFixed(0)}×${(area.height * 100).toFixed(0)}%`;

        return (
          <div
            key={area.id}
            role="option"
            className={`
              flex items-center gap-3 p-3 rounded-lg cursor-pointer
              transition-colors duration-150 border
              ${
                isSelected
                  ? "border-purple-primary bg-purple-primary/10"
                  : "border-gray-700 bg-dark-surface hover:border-gray-600"
              }
            `.trim()}
            onClick={() => onSelect(area.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(area.id);
              }
            }}
            tabIndex={0}
            aria-selected={isSelected}
            aria-label={`Área: ${area.variableName || "Sin nombre"}`}
          >
            {/* Color indicator */}
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 border-2"
              style={{
                backgroundColor: area.color + "40",
                borderColor: area.color,
              }}
              aria-hidden="true"
            />

            {/* Area info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {area.variableName || "Sin nombre"}
              </p>
              <p className="text-xs text-gray-400 truncate">{coordSummary}</p>
            </div>

            {/* Delete button */}
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(area.id);
              }}
              aria-label={`Eliminar área ${area.variableName || "Sin nombre"}`}
              className="flex-shrink-0"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
