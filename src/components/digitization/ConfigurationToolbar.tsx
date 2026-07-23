"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { AreaOfInterest, SegmentationConfig, SegmentationConfigMeta } from "@/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

export interface ConfigurationToolbarProps {
  templateId: string;
  areas: AreaOfInterest[];
  onLoadConfiguration: (config: SegmentationConfig) => void;
  onSaveConfiguration: (config: SegmentationConfig) => void;
  addToast: (toast: { type: "success" | "error" | "warning"; message: string }) => void;
}

export default function ConfigurationToolbar({
  templateId,
  areas,
  onLoadConfiguration,
  onSaveConfiguration,
  addToast,
}: ConfigurationToolbarProps) {
  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [configName, setConfigName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [existingConfigs, setExistingConfigs] = useState<SegmentationConfigMeta[]>([]);
  const [overwriteTarget, setOverwriteTarget] = useState<string | null>(null);

  // Load dropdown state
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [loadLoading, setLoadLoading] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState<SegmentationConfigMeta[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available configurations
  const fetchConfigurations = useCallback(async () => {
    if (!templateId) return;
    try {
      const response = await fetch(`/api/configs?templateId=${encodeURIComponent(templateId)}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableConfigs(data.configurations ?? []);
        setExistingConfigs(data.configurations ?? []);
      }
    } catch {
      // Silently fail — configs will show as empty
    }
  }, [templateId]);

  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLoadDropdown(false);
      }
    }
    if (showLoadDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showLoadDropdown]);

  // ─── Save Configuration ─────────────────────────────────────────────────────
  const handleOpenSaveModal = () => {
    setConfigName("");
    setOverwriteTarget(null);
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    const trimmedName = configName.trim();
    if (!trimmedName) return;

    // Check if configuration name already exists
    const existing = existingConfigs.find((c) => c.configName === trimmedName);
    if (existing && !overwriteTarget) {
      setOverwriteTarget(trimmedName);
      return;
    }

    setSaveLoading(true);
    try {
      const config: SegmentationConfig = {
        templateId,
        configName: trimmedName,
        areas,
        lastModified: new Date().toISOString(),
      };

      const response = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      onSaveConfiguration(config);
      addToast({ type: "success", message: "Configuración guardada exitosamente" });
      setShowSaveModal(false);
      setConfigName("");
      setOverwriteTarget(null);
      // Refresh configurations list
      await fetchConfigurations();
    } catch {
      // Error handling — preserve areas in memory (they are never cleared)
      addToast({ type: "error", message: "Error al guardar la configuración. Intente nuevamente" });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelSave = () => {
    setShowSaveModal(false);
    setConfigName("");
    setOverwriteTarget(null);
  };

  // ─── Load Configuration ─────────────────────────────────────────────────────
  const handleToggleLoadDropdown = async () => {
    if (!showLoadDropdown) {
      await fetchConfigurations();
    }
    setShowLoadDropdown(!showLoadDropdown);
  };

  const handleLoadConfig = async (meta: SegmentationConfigMeta) => {
    setLoadLoading(true);
    setShowLoadDropdown(false);
    try {
      const response = await fetch(
        `/api/configs/${encodeURIComponent(meta.templateId)}/${encodeURIComponent(meta.configName)}`
      );
      if (!response.ok) {
        throw new Error("Load failed");
      }
      const data = await response.json();
      const config: SegmentationConfig = data.config;
      onLoadConfiguration(config);
      addToast({ type: "success", message: `Configuración "${meta.configName}" cargada` });
    } catch {
      addToast({ type: "error", message: "Error al cargar la configuración. Intente nuevamente" });
    } finally {
      setLoadLoading(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Save button */}
      <Button
        variant="primary"
        size="sm"
        onClick={handleOpenSaveModal}
        disabled={areas.length === 0}
        aria-label="Guardar configuración"
      >
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
        Guardar
      </Button>

      {/* Load button with dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleToggleLoadDropdown}
          loading={loadLoading}
          aria-label="Cargar configuración"
          aria-expanded={showLoadDropdown}
          aria-haspopup="listbox"
        >
          <svg
            className="w-4 h-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Cargar
        </Button>

        {/* Dropdown menu */}
        {showLoadDropdown && (
          <div
            className="absolute top-full left-0 mt-1 w-72 bg-dark-surface border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
            role="listbox"
            aria-label="Configuraciones disponibles"
          >
            {availableConfigs.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">
                No hay configuraciones guardadas
              </div>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {availableConfigs.map((config) => (
                  <li key={`${config.templateId}-${config.configName}`}>
                    <button
                      className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0 focus:outline-none focus:bg-gray-800"
                      onClick={() => handleLoadConfig(config)}
                      role="option"
                      aria-selected={false}
                    >
                      <div className="text-sm font-medium text-gray-100">
                        {config.configName}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{config.areaCount} área{config.areaCount !== 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span>{formatDate(config.lastModified)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={handleCancelSave}
        title="Guardar configuración"
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la configuración"
            placeholder="Ej: formulario_inscripcion"
            value={configName}
            onChange={(e) => {
              setConfigName(e.target.value);
              setOverwriteTarget(null);
            }}
            required
            autoFocus
          />

          {/* Overwrite confirmation */}
          {overwriteTarget && (
            <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/50">
              <p className="text-sm text-yellow-300">
                Ya existe una configuración con el nombre &quot;{overwriteTarget}&quot;.
                ¿Desea sobrescribirla?
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={handleCancelSave}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saveLoading}
              disabled={!configName.trim()}
            >
              {overwriteTarget ? "Sobrescribir" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
