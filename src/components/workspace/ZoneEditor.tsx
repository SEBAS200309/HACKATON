"use client";

import React, { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AreaOfInterest, Variable, WorkspaceZone } from "@/types";
import CanvasOverlay from "@/components/digitization/CanvasOverlay";

export interface ZoneEditorProps {
  imageUrl: string;
  zones: WorkspaceZone[];
  orientation: 'portrait' | 'landscape';
  availableVariables: Variable[];
  onZoneCreated: (zone: WorkspaceZone) => void;
  onZoneUpdated: (zoneId: string, updates: Partial<WorkspaceZone>) => void;
  onZoneDeleted: (zoneId: string) => void;
  onPropagateZones: (toAll: boolean) => void;
  onToggleOrientation: () => void;
}

const AREA_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function getNextColor(zones: WorkspaceZone[]): string {
  const usedColors = new Set(zones.map((z) => z.color));
  for (const color of AREA_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return AREA_COLORS[zones.length % AREA_COLORS.length];
}

export default function ZoneEditor({
  imageUrl,
  zones,
  orientation,
  availableVariables,
  onZoneCreated,
  onZoneUpdated,
  onZoneDeleted,
  onPropagateZones,
  onToggleOrientation,
}: ZoneEditorProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showVariablePrompt, setShowVariablePrompt] = useState(false);
  const [pendingZone, setPendingZone] = useState<Omit<WorkspaceZone, "variableName"> | null>(null);

  // Mark which variables are already assigned to existing zones
  const variablesWithAssignment: Variable[] = availableVariables.map((v) => ({
    ...v,
    assigned: zones.some((z) => z.variableName === v.name),
  }));

  const unassignedVariables = variablesWithAssignment.filter((v) => !v.assigned);
  const assignedVariables = variablesWithAssignment.filter((v) => v.assigned);

  const handleAreaCreated = useCallback(
    (partialArea: Omit<AreaOfInterest, "id" | "variableName">) => {
      const id = uuidv4();
      const color = partialArea.color || getNextColor(zones);

      const newZone: Omit<WorkspaceZone, "variableName"> = {
        id,
        x: partialArea.x,
        y: partialArea.y,
        width: partialArea.width,
        height: partialArea.height,
        color,
      };

      setPendingZone(newZone);
      setShowVariablePrompt(true);
    },
    [zones]
  );

  const handleAreaUpdated = useCallback(
    (id: string, updates: Partial<AreaOfInterest>) => {
      onZoneUpdated(id, updates as Partial<WorkspaceZone>);
    },
    [onZoneUpdated]
  );

  const handleAreaDeleted = useCallback(
    (id: string) => {
      onZoneDeleted(id);
      if (selectedZoneId === id) {
        setSelectedZoneId(null);
      }
    },
    [onZoneDeleted, selectedZoneId]
  );

  const handleAreaSelected = useCallback((id: string | null) => {
    setSelectedZoneId(id);
  }, []);

  const handleVariableSelect = useCallback(
    (variableName: string) => {
      if (pendingZone) {
        const completeZone: WorkspaceZone = {
          ...pendingZone,
          variableName,
        };
        onZoneCreated(completeZone);
      }
      setPendingZone(null);
      setShowVariablePrompt(false);
    },
    [pendingZone, onZoneCreated]
  );

  const handleVariableCancel = useCallback(() => {
    setPendingZone(null);
    setShowVariablePrompt(false);
  }, []);

  // Cast WorkspaceZone[] to AreaOfInterest[] (structurally identical)
  const areasForCanvas = zones as unknown as AreaOfInterest[];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar con botón de orientación */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#a1a1aa]">
          Dibuje rectángulos sobre el documento para definir zonas de escaneo.
        </p>
        <button
          type="button"
          onClick={onToggleOrientation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-colors"
          title={orientation === 'portrait' ? 'Cambiar a horizontal' : 'Cambiar a vertical'}
          aria-label={orientation === 'portrait' ? 'Cambiar orientación a horizontal' : 'Cambiar orientación a vertical'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${orientation === 'landscape' ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{orientation === 'portrait' ? 'Horizontal' : 'Vertical'}</span>
        </button>
      </div>

      {/* Canvas section */}
      <div className="relative rounded-lg border border-gray-700 overflow-hidden bg-[#0f0a1a]">
        <CanvasOverlay
          imageUrl={imageUrl}
          areas={areasForCanvas}
          selectedAreaId={selectedZoneId}
          orientation={orientation}
          onAreaCreated={handleAreaCreated}
          onAreaUpdated={handleAreaUpdated}
          onAreaDeleted={handleAreaDeleted}
          onAreaSelected={handleAreaSelected}
        />

        {/* Variable assignment prompt overlay */}
        {showVariablePrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-[#1a1025] rounded-xl border border-gray-700 shadow-2xl p-5">
              <h3 className="text-sm font-semibold text-[#f5f5f5] mb-3">
                Asignar variable a la zona
              </h3>

              {/* Available variables */}
              {unassignedVariables.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#a1a1aa] mb-2">
                    Variables disponibles:
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {unassignedVariables.map((variable) => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => handleVariableSelect(variable.name)}
                        className="px-3 py-1.5 text-xs rounded-md border border-gray-600 bg-[#0f0a1a] text-gray-300 hover:border-[#a855f7] hover:text-[#f5f5f5] hover:bg-[#a855f7]/10 transition-colors"
                        aria-label={`Asignar variable ${variable.name}`}
                      >
                        {variable.name}
                        <span className="ml-1 text-gray-500">
                          ({variable.source})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Already assigned variables (greyed out) */}
              {assignedVariables.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Ya asignadas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assignedVariables.map((variable) => (
                      <span
                        key={variable.name}
                        className="px-3 py-1.5 text-xs rounded-md border border-gray-700 bg-[#0f0a1a] text-gray-500 line-through"
                      >
                        {variable.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* No variables available */}
              {availableVariables.length === 0 && (
                <p className="text-xs text-[#a1a1aa] mb-3">
                  No hay variables disponibles. Seleccione una plantilla primero.
                </p>
              )}

              {/* Cancel button */}
              <div className="flex justify-end pt-3 border-t border-gray-700">
                <button
                  type="button"
                  onClick={handleVariableCancel}
                  className="px-4 py-1.5 text-xs rounded-md border border-gray-600 text-[#a1a1aa] hover:text-[#f5f5f5] hover:border-gray-500 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Propagation buttons — only visible when zones exist */}
      {zones.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onPropagateZones(true)}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#a855f7] text-white hover:bg-[#9333ea] transition-colors"
          >
            Aplicar a todas las páginas
          </button>
          <button
            type="button"
            onClick={() => onPropagateZones(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-600 text-[#a1a1aa] hover:text-[#f5f5f5] hover:border-gray-500 transition-colors"
          >
            Solo esta página
          </button>
        </div>
      )}
    </div>
  );
}
