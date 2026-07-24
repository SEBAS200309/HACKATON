"use client";

import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "@/store/useAppStore";
import Button from "@/components/ui/Button";
import type { AreaOfInterest, SegmentationConfigMeta, WorkspaceZone } from "@/types";

// ─── Color palette for zones ──────────────────────────────────────────────────
const ZONE_COLORS = [
  "#a855f7", // purple
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
];

export interface SessionToolbarProps {
  onResetConfirmed: () => void;
}

export default function SessionToolbar({ onResetConfirmed }: SessionToolbarProps) {
  const [savingSession, setSavingSession] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState<SegmentationConfigMeta[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTemplate = useAppStore((s) => s.activeTemplate);
  const activeXlsxTemplate = useAppStore((s) => s.activeXlsxTemplate);
  const pages = useAppStore((s) => s.pages);
  const currentPageId = useAppStore((s) => s.currentPageId);
  const addToast = useAppStore((s) => s.addToast);
  const retakePage = useAppStore((s) => s.retakePage);

  // ─── Guardar sesión ───────────────────────────────────────────────────────
  const handleSaveSession = useCallback(async () => {
    if (!activeTemplate || pages.length === 0) {
      addToast({ type: "warning", message: "No hay datos para guardar." });
      return;
    }

    setSavingSession(true);
    try {
      const response = await fetch("/api/workspace/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: activeTemplate.id,
          xlsxTemplateId: activeXlsxTemplate?.id,
          pages,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data?.error?.message ?? "Error al guardar la sesión";
        addToast({ type: "error", message: errorMsg });
        return;
      }

      const data = await response.json();
      addToast({
        type: "success",
        message: `Sesión guardada exitosamente (ID: ${data.sessionId})`,
      });
    } catch {
      addToast({ type: "error", message: "Error de conexión al guardar la sesión" });
    } finally {
      setSavingSession(false);
    }
  }, [activeTemplate, activeXlsxTemplate, pages, addToast]);

  // ─── Re-tomar foto ────────────────────────────────────────────────────────
  const handleRetakeClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentPageId) return;

      setRetaking(true);
      try {
        // Upload file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "source");
        formData.append("fileName", file.name);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json();
          const errorMsg = data?.error?.message ?? "Error al subir la imagen";
          addToast({ type: "error", message: errorMsg });
          return;
        }

        const uploadData = await uploadResponse.json();

        // Convertir a data URL (sobrevive localStorage y navegación)
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Error al leer archivo"));
          reader.readAsDataURL(file);
        });

        retakePage(currentPageId, uploadData.s3Key, dataUrl);
        addToast({
          type: "success",
          message: "Foto actualizada. Los resultados OCR anteriores fueron eliminados.",
        });
      } catch {
        addToast({ type: "error", message: "Error de conexión al subir la imagen" });
      } finally {
        setRetaking(false);
        // Reset input value so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [currentPageId, addToast, retakePage]
  );

  // ─── Cargar configuración ─────────────────────────────────────────────────
  const handleLoadConfigsClick = useCallback(async () => {
    if (!activeTemplate) return;

    if (showConfigDropdown) {
      setShowConfigDropdown(false);
      return;
    }

    setLoadingConfigs(true);
    try {
      const response = await fetch(
        `/api/configs?templateId=${encodeURIComponent(activeTemplate.id)}`
      );

      if (!response.ok) {
        addToast({ type: "error", message: "Error al cargar las configuraciones" });
        return;
      }

      const data = await response.json();
      const configs: SegmentationConfigMeta[] = data.configurations ?? [];

      if (configs.length === 0) {
        addToast({ type: "warning", message: "No hay configuraciones guardadas para esta plantilla" });
        return;
      }

      setAvailableConfigs(configs);
      setShowConfigDropdown(true);
    } catch {
      addToast({ type: "error", message: "Error de conexión al cargar configuraciones" });
    } finally {
      setLoadingConfigs(false);
    }
  }, [activeTemplate, showConfigDropdown, addToast]);

  const handleSelectConfig = useCallback(
    async (config: SegmentationConfigMeta) => {
      setShowConfigDropdown(false);

      if (!activeTemplate) return;

      try {
        const response = await fetch(
          `/api/configs/${encodeURIComponent(config.templateId)}/${encodeURIComponent(config.configName)}`
        );

        if (!response.ok) {
          addToast({ type: "error", message: "Error al cargar la configuración seleccionada" });
          return;
        }

        const data = await response.json();
        const areas: AreaOfInterest[] = data.config?.areas ?? [];

        if (areas.length === 0) {
          addToast({ type: "warning", message: "La configuración seleccionada no tiene zonas definidas" });
          return;
        }

        // Map AreaOfInterest[] to WorkspaceZone[] with IDs and cycling colors
        const zones: WorkspaceZone[] = areas.map((area, index) => ({
          id: uuidv4(),
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          variableName: area.variableName,
          color: ZONE_COLORS[index % ZONE_COLORS.length],
        }));

        // Apply zones to all pages and update availableVariables
        const currentState = useAppStore.getState();
        const updatedPages = currentState.pages.map((page) => ({
          ...page,
          zones,
        }));

        // Recalcular assigned en availableVariables
        const allZoneVarNames = new Set(zones.map((z) => z.variableName));
        const updatedVariables = currentState.availableVariables.map((v) => ({
          ...v,
          assigned: allZoneVarNames.has(v.name),
        }));

        useAppStore.setState({ pages: updatedPages, availableVariables: updatedVariables });
        addToast({ type: "success", message: "Configuración aplicada a todas las páginas" });
      } catch {
        addToast({ type: "error", message: "Error de conexión al aplicar la configuración" });
      }
    },
    [activeTemplate, addToast]
  );

  // ─── Nueva sesión con confirmación ────────────────────────────────────────
  const handleNewSessionClick = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setShowResetConfirm(false);
    onResetConfirmed();
  }, [onResetConfirmed]);

  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      {/* Guardar sesión */}
      <Button
        variant="secondary"
        size="sm"
        loading={savingSession}
        onClick={handleSaveSession}
        disabled={pages.length === 0}
      >
        Guardar sesión
      </Button>

      {/* Re-tomar foto */}
      <Button
        variant="secondary"
        size="sm"
        loading={retaking}
        onClick={handleRetakeClick}
        disabled={!currentPageId}
      >
        Re-tomar foto
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
        aria-label="Seleccionar nueva imagen"
      />

      {/* Cargar configuración */}
      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          loading={loadingConfigs}
          onClick={handleLoadConfigsClick}
        >
          Cargar configuración
        </Button>

        {/* Dropdown de configuraciones */}
        {showConfigDropdown && availableConfigs.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-h-48 overflow-y-auto rounded-lg border border-purple-500/20 bg-[#1a1025] shadow-lg">
            {availableConfigs.map((config) => (
              <button
                key={`${config.templateId}-${config.configName}`}
                type="button"
                onClick={() => handleSelectConfig(config)}
                className="w-full text-left px-3 py-2 text-sm text-[#f5f5f5] hover:bg-purple-500/10 transition-colors border-b border-purple-500/10 last:border-b-0"
              >
                <span className="block font-medium">{config.configName}</span>
                <span className="block text-xs text-[#a1a1aa]">
                  {config.areaCount} zona{config.areaCount !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nueva sesión */}
      <Button variant="danger" size="sm" onClick={handleNewSessionClick}>
        Nueva sesión
      </Button>

      {/* Diálogo de confirmación para nueva sesión */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl border border-purple-500/20 bg-[#1a1025] p-6 shadow-2xl max-w-sm mx-4"
            role="alertdialog"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-desc"
          >
            <h3
              id="reset-confirm-title"
              className="text-lg font-semibold text-[#f5f5f5] mb-2"
            >
              ¿Nueva sesión?
            </h3>
            <p
              id="reset-confirm-desc"
              className="text-sm text-[#a1a1aa] mb-6"
            >
              ¿Está seguro? Se perderá todo el progreso actual.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={handleCancelReset}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmReset}>
                Sí, nueva sesión
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
