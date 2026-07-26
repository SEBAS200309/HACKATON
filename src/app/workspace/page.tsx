"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "@/store/useAppStore";
import { useWorkspaceCache } from "@/hooks/useWorkspaceCache";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import BatchGeneratePanel from "@/components/workspace/BatchGeneratePanel";
import OcrProcessingPanel from "@/components/workspace/OcrProcessingPanel";
import BatchResultsTable from "@/components/workspace/BatchResultsTable";
import ResultsEditorModal from "@/components/workspace/ResultsEditorModal";
import SessionToolbar from "@/components/workspace/SessionToolbar";
import ZoneEditor from "@/components/workspace/ZoneEditor";
import PerspectiveEditor from "@/components/digitization/PerspectiveEditor";
import type { GeneratedFile, TemplateMetadata, WorkspaceZone } from "@/types";

export default function WorkspacePage() {
  const [initializing, setInitializing] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedWordTemplate, setSelectedWordTemplate] = useState<TemplateMetadata | null>(null);
  const [selectedXlsxTemplate, setSelectedXlsxTemplate] = useState<TemplateMetadata | null>(null);

  // Estado para el modal de recorte de perspectiva
  const [cropModalBlob, setCropModalBlob] = useState<Blob | null>(null);
  const [cropModalFileName, setCropModalFileName] = useState<string>("");

  // Estado para el modal de edición de variable
  const [editingVariable, setEditingVariable] = useState<string | null>(null);

  // Estado para el modal de edición de resultados
  const [showResultsEditor, setShowResultsEditor] = useState(false);

  const workspaceActive = useAppStore((s) => s.workspaceActive);
  const activeTemplate = useAppStore((s) => s.activeTemplate);
  const activeXlsxTemplate = useAppStore((s) => s.activeXlsxTemplate);
  const pages = useAppStore((s) => s.pages);
  const currentPageId = useAppStore((s) => s.currentPageId);
  const availableVariables = useAppStore((s) => s.availableVariables);
  const batchProgress = useAppStore((s) => s.batchProgress);
  const generatedFiles = useAppStore((s) => s.generatedFiles);
  const wordTemplates = useAppStore((s) => s.wordTemplates);
  const xlsxTemplates = useAppStore((s) => s.xlsxTemplates);
  const initWorkspace = useAppStore((s) => s.initWorkspace);
  const resetWorkspace = useAppStore((s) => s.resetWorkspace);
  const restoreFromLocalStorage = useAppStore((s) => s.restoreFromLocalStorage);
  const persistToLocalStorage = useAppStore((s) => s.persistToLocalStorage);
  const addToast = useAppStore((s) => s.addToast);
  const loadTemplates = useAppStore((s) => s.loadTemplates);
  const updateRecord = useAppStore((s) => s.updateRecord);
  const addZone = useAppStore((s) => s.addZone);
  const removeZone = useAppStore((s) => s.removeZone);
  const propagateZones = useAppStore((s) => s.propagateZones);
  const addPage = useAppStore((s) => s.addPage);
  const removePage = useAppStore((s) => s.removePage);
  const updateVariableSettings = useAppStore((s) => s.updateVariableSettings);

  // Integración de caché de imágenes y OCR para el workspace
  const { loadPageImage } = useWorkspaceCache();
  const [cachedImageUrls, setCachedImageUrls] = useState<Record<string, string>>({});

  // Ref y handler para "Agregar página"
  const addPageInputRef = useRef<HTMLInputElement>(null);
  const [addingPage, setAddingPage] = useState(false);

  const handleAddPageClick = useCallback(() => {
    addPageInputRef.current?.click();
  }, []);

  // Cuando el usuario selecciona un archivo, abrir el modal de recorte
  const handleAddPageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCropModalBlob(file);
      setCropModalFileName(file.name);
      // Reset input para permitir seleccionar el mismo archivo de nuevo
      if (addPageInputRef.current) {
        addPageInputRef.current.value = "";
      }
    },
    []
  );

  // Cuando el usuario acepta el recorte del PerspectiveEditor
  const handleCropAccept = useCallback(
    async (correctedBlob: Blob, correctedCanvas: HTMLCanvasElement) => {
      setCropModalBlob(null);
      setAddingPage(true);

      try {
        // Aplicar filtro grayscaleWhiteEnhance a la imagen recortada
        const { applyFilter } = await import("@/utils/imageFilters");
        const { blob: filteredBlob } = await applyFilter(correctedCanvas, "grayscaleWhiteEnhance");

        // Subir imagen filtrada a /api/upload
        const formData = new FormData();
        formData.append("file", filteredBlob, cropModalFileName);
        formData.append("type", "source");
        formData.append("fileName", cropModalFileName);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          addToast({ type: "error", message: "Error al subir la imagen" });
          return;
        }

        const uploadData = await uploadResponse.json();

        // Convertir a data URL para mostrar en el workspace
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Error al leer archivo"));
          reader.readAsDataURL(filteredBlob);
        });

        addPage({
          id: uuidv4(),
          imageS3Key: uploadData.s3Key,
          imageUrl: dataUrl,
          zones: [],
          record: {},
          ocrProcessed: false,
          status: "pending",
        });

        addToast({ type: "success", message: "Página agregada exitosamente" });
      } catch {
        addToast({ type: "error", message: "Error al agregar la página" });
      } finally {
        setAddingPage(false);
      }
    },
    [addPage, addToast, cropModalFileName]
  );

  // Cuando el usuario cancela o salta el recorte — agregar imagen sin recortar
  const handleCropSkip = useCallback(
    async () => {
      if (!cropModalBlob) return;
      setCropModalBlob(null);
      setAddingPage(true);

      try {
        // Crear canvas desde el blob original y aplicar filtro
        const img = new Image();
        const tempUrl = URL.createObjectURL(cropModalBlob);
        const filteredBlob = await new Promise<Blob>((resolve, reject) => {
          img.onload = async () => {
            URL.revokeObjectURL(tempUrl);
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("No canvas context")); return; }
            ctx.drawImage(img, 0, 0);
            try {
              const { applyFilter } = await import("@/utils/imageFilters");
              const { blob } = await applyFilter(canvas, "grayscaleWhiteEnhance");
              resolve(blob);
            } catch (err) { reject(err); }
          };
          img.onerror = () => { URL.revokeObjectURL(tempUrl); reject(new Error("Image load failed")); };
          img.src = tempUrl;
        });

        // Subir
        const formData = new FormData();
        formData.append("file", filteredBlob, cropModalFileName);
        formData.append("type", "source");
        formData.append("fileName", cropModalFileName);

        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadResponse.ok) {
          addToast({ type: "error", message: "Error al subir la imagen" });
          return;
        }
        const uploadData = await uploadResponse.json();

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Error al leer archivo"));
          reader.readAsDataURL(filteredBlob);
        });

        addPage({
          id: uuidv4(),
          imageS3Key: uploadData.s3Key,
          imageUrl: dataUrl,
          zones: [],
          record: {},
          ocrProcessed: false,
          status: "pending",
        });

        addToast({ type: "success", message: "Página agregada sin recorte" });
      } catch {
        addToast({ type: "error", message: "Error al agregar la página" });
      } finally {
        setAddingPage(false);
      }
    },
    [cropModalBlob, cropModalFileName, addPage, addToast]
  );

  // Cancelar el modal sin agregar nada
  const handleCropReject = useCallback(() => {
    setCropModalBlob(null);
  }, []);

  // Sync auth on mount (middleware handles real auth)
  useEffect(() => {
    useAppStore.setState({ isAuthenticated: true });
  }, []);

  // Restore workspace state from localStorage on mount — only if not already active
  // (if coming from /digitize flow, the workspace is already initialized in-memory)
  useEffect(() => {
    const currentState = useAppStore.getState();
    if (currentState.workspaceActive && currentState.pages.length > 0) {
      // Workspace was already initialized by the digitize flow — don't overwrite
      setInitializing(false);
      return;
    }

    const restored = restoreFromLocalStorage();
    if (!restored) {
      // No previous session — will show template selection
    }
    setInitializing(false);
  }, [restoreFromLocalStorage]);

  // Load templates when in template selection mode
  useEffect(() => {
    if (!initializing && !workspaceActive) {
      setLoadingTemplates(true);
      loadTemplates().finally(() => setLoadingTemplates(false));
    }
  }, [initializing, workspaceActive, loadTemplates]);

  // Auto-save workspace state to localStorage every 30 seconds
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePersist = useCallback(() => {
    const success = persistToLocalStorage();
    if (!success) {
      addToast({
        type: 'warning',
        message: 'No se pudo guardar el estado. Los datos se perderán al cerrar.',
      });
    }
  }, [persistToLocalStorage, addToast]);

  useEffect(() => {
    if (!workspaceActive) {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      return;
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [workspaceActive, handlePersist]);

  // Clear workspace state when page/tab closes or URL changes
  useEffect(() => {
    if (!workspaceActive) return;

    const handleBeforeUnload = () => {
      // Limpiar workspace de localStorage al cerrar/salir
      try {
        localStorage.removeItem('workspace-session-state');
      } catch {
        // Silently fail
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [workspaceActive]);

  // Cargar imágenes de páginas usando caché (Req 1.5, 1.6)
  const loadedPageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceActive || pages.length === 0) return;

    const loadImages = async () => {
      for (const page of pages) {
        // Si ya cargamos esta página, saltar
        if (loadedPageIdsRef.current.has(page.id)) continue;
        loadedPageIdsRef.current.add(page.id);

        try {
          const url = await loadPageImage(page);
          setCachedImageUrls((prev) => ({ ...prev, [page.id]: url }));
        } catch {
          // Fallback silencioso — usar imageUrl directa
          setCachedImageUrls((prev) => ({ ...prev, [page.id]: page.imageUrl }));
        }
      }
    };

    loadImages();
  }, [workspaceActive, pages, loadPageImage]);

  const handleInitWorkspace = () => {
    if (!selectedWordTemplate && !selectedXlsxTemplate) return;
    initWorkspace(selectedWordTemplate, selectedXlsxTemplate);
  };

  // Loading state while initializing
  if (initializing) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0f0a1a]">
        <LoadingSpinner message="Cargando espacio de trabajo..." size="lg" />
      </main>
    );
  }

  // Template selection mode — workspace not active
  if (!workspaceActive) {
    return (
      <main className="min-h-screen bg-[#0f0a1a] px-4 py-6 sm:px-6 lg:px-8">
        <header className="max-w-3xl mx-auto flex items-center justify-between mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">
            Espacio de Trabajo
          </h1>
        </header>

        <div className="max-w-3xl mx-auto">
          <section className="rounded-xl bg-[#1a1025] border border-purple-500/20 p-6">
            <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">
              Seleccionar plantilla para iniciar
            </h2>
            <p className="text-sm text-[#a1a1aa] mb-6">
              Seleccione al menos una plantilla (Word, Excel, o ambas) para comenzar el procesamiento.
            </p>

            {loadingTemplates ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner message="Cargando plantillas..." />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Word template selection */}
                <div>
                  <label className="block text-sm font-medium text-[#f5f5f5] mb-2">
                    Plantilla Word <span className="text-[#a1a1aa]">(opcional)</span>
                  </label>
                  {wordTemplates.length === 0 ? (
                    <p className="text-sm text-[#a1a1aa]">
                      No hay plantillas Word disponibles. Suba una desde el panel de plantillas.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {wordTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedWordTemplate(template)}
                          className={`w-full text-left rounded-lg border p-3 transition-colors duration-150 ${
                            selectedWordTemplate?.id === template.id
                              ? "border-purple-500 bg-purple-500/10"
                              : "border-purple-500/20 bg-[#0f0a1a] hover:border-purple-500/40"
                          }`}
                        >
                          <span className="text-sm font-medium text-[#f5f5f5]">
                            {template.fileName}
                          </span>
                          <span className="block text-xs text-[#a1a1aa] mt-0.5">
                            {template.placeholders.length} variable{template.placeholders.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* XLSX template selection (optional) */}
                <div>
                  <label className="block text-sm font-medium text-[#f5f5f5] mb-2">
                    Plantilla Excel <span className="text-[#a1a1aa]">(opcional)</span>
                  </label>
                  {xlsxTemplates.length === 0 ? (
                    <p className="text-sm text-[#a1a1aa]">
                      No hay plantillas Excel disponibles.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {xlsxTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() =>
                            setSelectedXlsxTemplate(
                              selectedXlsxTemplate?.id === template.id ? null : template
                            )
                          }
                          className={`w-full text-left rounded-lg border p-3 transition-colors duration-150 ${
                            selectedXlsxTemplate?.id === template.id
                              ? "border-purple-500 bg-purple-500/10"
                              : "border-purple-500/20 bg-[#0f0a1a] hover:border-purple-500/40"
                          }`}
                        >
                          <span className="text-sm font-medium text-[#f5f5f5]">
                            {template.fileName}
                          </span>
                          <span className="block text-xs text-[#a1a1aa] mt-0.5">
                            {template.placeholders.length} columna{template.placeholders.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Init button */}
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!selectedWordTemplate && !selectedXlsxTemplate}
                    onClick={handleInitWorkspace}
                  >
                    Iniciar espacio de trabajo
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  // Active workspace layout
  const currentPage = pages.find((p) => p.id === currentPageId) ?? null;
  // URL de imagen cacheada para la página actual (Req 1.5, 1.6)
  const currentPageImageUrl = currentPage
    ? cachedImageUrls[currentPage.id] ?? currentPage.imageUrl
    : null;

  return (
    <main className="min-h-screen flex flex-col bg-[#0f0a1a]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-[#1a1025]">
        <h1 className="text-lg sm:text-xl font-bold text-[#f5f5f5]">
          Espacio de Trabajo
        </h1>
        <div className="flex items-center gap-3">
          {activeTemplate && (
            <span className="hidden sm:inline text-xs text-[#a1a1aa]">
              Plantilla: {activeTemplate.fileName}
            </span>
          )}
          <SessionToolbar onResetConfirmed={resetWorkspace} />
        </div>
      </header>

      {/* Main workspace layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left sidebar — Page thumbnails */}
        <aside className="w-full lg:w-48 xl:w-56 border-b lg:border-b-0 lg:border-r border-purple-500/20 bg-[#1a1025]/50 overflow-y-auto">
          <div className="p-3">
            <h2 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wide mb-2">
              Páginas ({pages.length})
            </h2>
            {/* PageThumbnailList component will be integrated here */}
            <div className="space-y-2">
              {pages.length === 0 ? (
                <p className="text-xs text-[#a1a1aa]">
                  No hay páginas capturadas aún.
                </p>
              ) : (
                pages.map((page) => (
                  <div
                    key={page.id}
                    className={`rounded-lg border p-2 text-xs cursor-pointer transition-colors ${
                      page.id === currentPageId
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-purple-500/20 hover:border-purple-500/40"
                    }`}
                    onClick={() => useAppStore.getState().setCurrentPage(page.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        useAppStore.getState().setCurrentPage(page.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#f5f5f5]">Pág. {page.pageNumber}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePage(page.id);
                        }}
                        className="text-[#a1a1aa] hover:text-red-400 transition-colors p-0.5"
                        aria-label={`Eliminar página ${page.pageNumber}`}
                        title="Eliminar página"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <span className={`block mt-0.5 ${
                      page.status === "completed" ? "text-green-400" :
                      page.status === "processing" ? "text-yellow-400" :
                      page.status === "error" ? "text-red-400" :
                      "text-[#a1a1aa]"
                    }`}>
                      {page.status === "completed" ? "Completada" :
                       page.status === "processing" ? "Procesando" :
                       page.status === "error" ? "Error" :
                       "Pendiente"}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Agregar página */}
            <button
              type="button"
              onClick={handleAddPageClick}
              disabled={addingPage}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#a855f7]/10 px-3 py-2 text-xs font-medium text-[#a855f7] hover:bg-[#a855f7]/20 hover:border-purple-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingPage ? (
                <span>Subiendo...</span>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Agregar página</span>
                </>
              )}
            </button>
            <input
              ref={addPageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddPageFile}
              aria-label="Seleccionar imagen para nueva página"
            />
          </div>
        </aside>

        {/* Center — Main editor area */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 overflow-auto">
            {currentPage && currentPageImageUrl ? (
              <ZoneEditor
                imageUrl={currentPageImageUrl}
                zones={currentPage.zones}
                availableVariables={availableVariables}
                onZoneCreated={(zone: WorkspaceZone) => addZone(currentPage.id, zone)}
                onZoneUpdated={(zoneId: string, updates: Partial<WorkspaceZone>) => {
                  // Update zone in store by replacing the zones array
                  useAppStore.setState((state) => ({
                    pages: state.pages.map((p) =>
                      p.id === currentPage.id
                        ? { ...p, zones: p.zones.map((z) => z.id === zoneId ? { ...z, ...updates } : z) }
                        : p
                    ),
                  }));
                }}
                onZoneDeleted={(zoneId: string) => removeZone(currentPage.id, zoneId)}
                onPropagateZones={(toAll: boolean) => propagateZones(currentPage.id, toAll)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-[#a1a1aa]">
                  Capture o cargue una página para comenzar a definir zonas.
                </p>
              </div>
            )}
          </div>

          {/* Batch progress indicator */}
          {batchProgress && (
            <div className="px-4 py-2 border-t border-purple-500/20 bg-[#1a1025]">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[#0f0a1a] overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[#a1a1aa]">
                  {batchProgress.current}/{batchProgress.total}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Right panel — Zones/Variables + Results */}
        <aside className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-purple-500/20 bg-[#1a1025]/50 overflow-y-auto">
          <div className="flex flex-col h-full">
            {/* Zone/Variable assignment panel */}
            <div className="p-3 border-b border-purple-500/20">
              <h2 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wide mb-2">
                Variables ({availableVariables.length})
              </h2>
              {availableVariables.length === 0 ? (
                <p className="text-xs text-[#a1a1aa]">
                  No hay variables disponibles.
                </p>
              ) : (
                <div className="space-y-1">
                  {availableVariables.map((variable) => (
                    <div
                      key={variable.name}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-xs bg-[#0f0a1a] border border-purple-500/10"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[#f5f5f5] truncate">{variable.name}</span>
                        {!variable.required && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 shrink-0">Opc</span>
                        )}
                        {variable.broadcastToAll && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0">Todos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          variable.assigned
                            ? "bg-green-500/20 text-green-400"
                            : "bg-[#1a1025] text-[#a1a1aa]"
                        }`}>
                          {variable.assigned ? "✓" : "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingVariable(variable.name)}
                          className="p-0.5 text-[#a1a1aa] hover:text-purple-400 transition-colors"
                          aria-label={`Configurar variable ${variable.name}`}
                          title="Configurar variable"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Results/Batch panel */}
            <div className="p-3 flex-1">
              <h2 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wide mb-2">
                Resultados
              </h2>

              {/* OCR Processing Panel */}
              <div className="mb-3">
                <OcrProcessingPanel />
              </div>

              {/* Batch Results Table — show when pages have OCR results */}
              {pages.some((p) => p.ocrProcessed) && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#a1a1aa]">
                      {pages.filter((p) => p.ocrProcessed).length} página(s) procesada(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResultsEditor(true)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors"
                      title="Editar resultados"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Editar
                    </button>
                  </div>
                  <BatchResultsTable
                    pages={pages.filter((p) => p.ocrProcessed)}
                    variables={availableVariables.filter((v) => v.assigned)}
                    onUpdateRecord={updateRecord}
                  />
                </div>
              )}

              {/* BatchGeneratePanel — handles API call, progress, and downloads */}
              {pages.length > 0 && (
                <div className="mb-3">
                  <BatchGeneratePanel
                    pages={pages}
                    templateId={activeTemplate?.id ?? activeXlsxTemplate?.id ?? ""}
                    xlsxTemplateId={activeXlsxTemplate?.id}
                    assignedVariables={availableVariables
                      .filter((v) => v.assigned && v.required)
                      .map((v) => v.name)}
                    onBatchComplete={(files: GeneratedFile[]) => {
                      useAppStore.setState({ generatedFiles: files });
                    }}
                    onProgressUpdate={(progress) => {
                      useAppStore.setState({ batchProgress: progress });
                    }}
                  />
                </div>
              )}

              {/* Generated files list */}
              {generatedFiles.length === 0 ? (
                <p className="text-xs text-[#a1a1aa]">
                  No hay archivos generados aún.
                </p>
              ) : (
                <div className="space-y-1">
                  {generatedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-xs bg-[#0f0a1a] border border-purple-500/10"
                    >
                      <span className="text-[#f5f5f5] truncate">{file.fileName}</span>
                      <a
                        href={file.downloadUrl}
                        download
                        className="text-purple-400 hover:text-purple-300 ml-2 shrink-0"
                      >
                        Descargar
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Modal de edición de resultados OCR */}
      {showResultsEditor && (
        <ResultsEditorModal
          pages={pages.filter((p) => p.ocrProcessed)}
          variables={availableVariables.filter((v) => v.assigned)}
          onSave={(updatedPages) => {
            // Aplicar cambios al store
            useAppStore.setState((state) => ({
              pages: state.pages.map((p) => {
                const updated = updatedPages.find((u) => u.id === p.id);
                return updated ?? p;
              }),
            }));
          }}
          onClose={() => setShowResultsEditor(false)}
        />
      )}

      {/* Modal de configuración de variable */}
      {editingVariable && (() => {
        const variable = availableVariables.find((v) => v.name === editingVariable);
        if (!variable) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1025] border border-purple-500/30 rounded-xl w-full max-w-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">
                  Configurar: {variable.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingVariable(null)}
                  className="text-[#a1a1aa] hover:text-[#f5f5f5] transition-colors"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Required toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-[#f5f5f5]">Requerido</span>
                    <p className="text-[10px] text-[#a1a1aa]">Si está desactivado, no será obligatorio para generar documentos</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={variable.required}
                    onClick={() => updateVariableSettings(variable.name, { required: !variable.required })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      variable.required ? "bg-purple-500" : "bg-gray-600"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      variable.required ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </label>

                {/* Broadcast to all toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm text-[#f5f5f5]">Aplicar a todos los registros</span>
                    <p className="text-[10px] text-[#a1a1aa]">El valor extraído se copia a todas las filas (para datos compartidos como Equipo o Juez)</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={variable.broadcastToAll}
                    onClick={() => updateVariableSettings(variable.name, { broadcastToAll: !variable.broadcastToAll })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      variable.broadcastToAll ? "bg-purple-500" : "bg-gray-600"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      variable.broadcastToAll ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingVariable(null)}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de recorte de perspectiva */}
      {cropModalBlob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1025] border border-purple-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#f5f5f5]">
                Seleccionar área del documento
              </h3>
              <button
                type="button"
                onClick={handleCropReject}
                className="text-[#a1a1aa] hover:text-[#f5f5f5] transition-colors"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <PerspectiveEditor
              imageBlob={cropModalBlob}
              onAccept={handleCropAccept}
              onReject={handleCropReject}
              onSkip={handleCropSkip}
            />
          </div>
        </div>
      )}
    </main>
  );
}
