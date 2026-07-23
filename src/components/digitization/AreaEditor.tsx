"use client";

import React, { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AreaOfInterest, Variable, SegmentationConfig } from "@/types";
import { useAppStore, startAreasAutoSave, stopAreasAutoSave } from "@/store/useAppStore";
import CanvasOverlay from "./CanvasOverlay";
import AreaList from "./AreaList";
import VariableAssigner from "./VariableAssigner";
import ConfigurationToolbar from "./ConfigurationToolbar";

export interface AreaEditorProps {
  documentUrl: string;
  availableVariables: Variable[];
  existingAreas: AreaOfInterest[];
  onAreasChange: (areas: AreaOfInterest[]) => void;
  onSaveConfiguration: (config: SegmentationConfig) => void;
  templateId?: string;
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

function getNextColor(areas: AreaOfInterest[]): string {
  const usedColors = new Set(areas.map((a) => a.color));
  // Find first unused color in the palette
  for (const color of AREA_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  // If all used, cycle based on count
  return AREA_COLORS[areas.length % AREA_COLORS.length];
}

export default function AreaEditor({
  documentUrl,
  availableVariables,
  existingAreas,
  onAreasChange,
  onSaveConfiguration,
  templateId,
}: AreaEditorProps) {
  const [areas, setAreas] = useState<AreaOfInterest[]>(existingAreas);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [showVariableAssigner, setShowVariableAssigner] = useState(false);
  const [pendingAreaId, setPendingAreaId] = useState<string | null>(null);

  const addToast = useAppStore((state) => state.addToast);
  const selectedWordTemplate = useAppStore((state) => state.selectedWordTemplate);

  // Resolve templateId from props or store
  const resolvedTemplateId = templateId || selectedWordTemplate?.id || "";

  // Start auto-save on mount, stop on unmount
  useEffect(() => {
    startAreasAutoSave();
    return () => {
      stopAreasAutoSave();
    };
  }, []);

  const updateAreas = useCallback(
    (newAreas: AreaOfInterest[]) => {
      setAreas(newAreas);
      onAreasChange(newAreas);
    },
    [onAreasChange]
  );

  // Mark which variables are already assigned
  const variablesWithAssignment: Variable[] = availableVariables.map((v) => ({
    ...v,
    assigned: areas.some((a) => a.variableName === v.name),
  }));

  const handleAreaCreated = useCallback(
    (partialArea: Omit<AreaOfInterest, "id" | "variableName">) => {
      const id = uuidv4();
      const color = partialArea.color || getNextColor(areas);

      const newArea: AreaOfInterest = {
        ...partialArea,
        id,
        variableName: "",
        color,
      };

      const newAreas = [...areas, newArea];
      updateAreas(newAreas);

      // Open variable assigner for the new area
      setPendingAreaId(id);
      setSelectedAreaId(id);
      setShowVariableAssigner(true);
    },
    [areas, updateAreas]
  );

  const handleAreaUpdated = useCallback(
    (id: string, updates: Partial<AreaOfInterest>) => {
      const newAreas = areas.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      );
      updateAreas(newAreas);
    },
    [areas, updateAreas]
  );

  const handleAreaDeleted = useCallback(
    (id: string) => {
      const newAreas = areas.filter((a) => a.id !== id);
      updateAreas(newAreas);
      if (selectedAreaId === id) {
        setSelectedAreaId(null);
      }
    },
    [areas, selectedAreaId, updateAreas]
  );

  const handleAreaSelected = useCallback((id: string | null) => {
    setSelectedAreaId(id);
  }, []);

  const handleVariableAssigned = useCallback(
    (variableName: string) => {
      if (pendingAreaId) {
        const newAreas = areas.map((a) =>
          a.id === pendingAreaId ? { ...a, variableName } : a
        );
        updateAreas(newAreas);
      }
      setShowVariableAssigner(false);
      setPendingAreaId(null);
    },
    [pendingAreaId, areas, updateAreas]
  );

  const handleVariableCancel = useCallback(() => {
    // Remove the pending area if user cancels variable assignment
    if (pendingAreaId) {
      const newAreas = areas.filter((a) => a.id !== pendingAreaId);
      updateAreas(newAreas);
      setSelectedAreaId(null);
    }
    setShowVariableAssigner(false);
    setPendingAreaId(null);
  }, [pendingAreaId, areas, updateAreas]);

  // Handle loading a configuration — overlay saved areas on current document
  const handleLoadConfiguration = useCallback(
    (config: SegmentationConfig) => {
      updateAreas(config.areas);
    },
    [updateAreas]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar with save/load buttons */}
      {resolvedTemplateId && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-gray-200">
            Configuración de áreas
          </h3>
          <ConfigurationToolbar
            templateId={resolvedTemplateId}
            areas={areas}
            onLoadConfiguration={handleLoadConfiguration}
            onSaveConfiguration={onSaveConfiguration}
            addToast={addToast}
          />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Canvas section */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg border border-gray-700 overflow-hidden bg-dark-bg">
            <CanvasOverlay
              imageUrl={documentUrl}
              areas={areas}
              selectedAreaId={selectedAreaId}
              onAreaCreated={handleAreaCreated}
              onAreaUpdated={handleAreaUpdated}
              onAreaDeleted={handleAreaDeleted}
              onAreaSelected={handleAreaSelected}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Dibuje rectángulos sobre el documento para definir áreas de interés.
            Use Delete para eliminar el área seleccionada.
          </p>
        </div>

        {/* Sidebar: area list */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">
            Áreas definidas ({areas.length})
          </h3>
          <AreaList
            areas={areas}
            selectedAreaId={selectedAreaId}
            onSelect={handleAreaSelected}
            onDelete={handleAreaDeleted}
          />
        </div>

        {/* Variable assigner modal */}
        <VariableAssigner
          isOpen={showVariableAssigner}
          availableVariables={variablesWithAssignment}
          onAssign={handleVariableAssigned}
          onCancel={handleVariableCancel}
        />
      </div>
    </div>
  );
}
