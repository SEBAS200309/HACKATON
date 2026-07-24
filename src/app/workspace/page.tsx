"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useWorkspaceCache } from "@/hooks/useWorkspaceCache";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import BatchGeneratePanel from "@/components/workspace/BatchGeneratePanel";
import OcrProcessingPanel from "@/components/workspace/OcrProcessingPanel";
import BatchResultsTable from "@/components/workspace/BatchResultsTable";
import SessionToolbar from "@/components/workspace/SessionToolbar";
import type { GeneratedFile, TemplateMetadata } from "@/types";

export default function WorkspacePage() {
  const [initializing, setInitializing] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedWordTemplate, setSelectedWordTemplate] = useState<TemplateMetadata | null>(null);
  const [selectedXlsxTemplate, setSelectedXlsxTemplate] = useState<TemplateMetadata | null>(null);

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

  // Integración de caché de imágenes y OCR para el workspace
  const { loadPageImage, getCachedOcrResults, setCachedOcrResults, refilterLocally } = useWorkspaceCache();
  const [cachedImageUrls, setCachedImageUrls] = useState<Record<string, string>>({});

  // Sync auth on mount (middleware handles real auth)
  useEffect(() => {
    useAppStore.setState({ isAuthenticated: true });
  }, []);

  // Restore workspace state from localStorage on mount
  useEffect(() => {
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

    autoSaveIntervalRef.current = setInterval(handlePersist, 30_000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [workspaceActive, handlePersist]);

  // Save workspace state before page unload + warn about unsaved changes
  useEffect(() => {
    if (!workspaceActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      persistToLocalStorage();
      // Trigger browser's native "unsaved changes" confirmation
      if (pages.length > 0) {
        e.preventDefault();
        e.returnValue = "Tiene cambios sin guardar. ¿Está seguro que desea salir?";
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [workspaceActive, persistToLocalStorage, pages.length]);

  // Cargar imágenes de páginas usando caché (Req 1.5, 1.6)
  useEffect(() => {
    if (!workspaceActive || pages.length === 0) return;

    const loadImages = async () => {
      for (const page of pages) {
        // Si ya tenemos la URL cacheada, saltar
        if (cachedImageUrls[page.id]) continue;

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
  }, [workspaceActive, pages, loadPageImage, cachedImageUrls]);

  const handleInitWorkspace = () => {
    if (!selectedWordTemplate) return;
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
              Seleccione una plantilla Word (requerida) y opcionalmente una plantilla Excel para comenzar el procesamiento por lotes.
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
                    Plantilla Word <span className="text-red-400">*</span>
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
                    disabled={!selectedWordTemplate}
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
                    <span className="text-[#f5f5f5]">Pág. {page.pageNumber}</span>
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
          </div>
        </aside>

        {/* Center — Main editor area */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {/* ZoneEditor component will be integrated here */}
            {currentPage ? (
              <div className="w-full h-full flex items-center justify-center rounded-xl border border-dashed border-purple-500/30 bg-[#1a1025]/30 relative overflow-hidden">
                {/* Mostrar imagen de la página usando URL cacheada (Req 1.5, 1.6) */}
                {currentPageImageUrl && (
                  <img
                    src={currentPageImageUrl}
                    alt={`Página ${currentPage.pageNumber}`}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
                <div className="absolute bottom-3 left-3 bg-[#0f0a1a]/80 rounded px-2 py-1">
                  <p className="text-xs text-[#a1a1aa]">
                    Página {currentPage.pageNumber} — {currentPage.zones.length} zona{currentPage.zones.length !== 1 ? "s" : ""} definida{currentPage.zones.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
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
              {/* ZoneVariableAssigner component will be integrated here */}
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
                      <span className="text-[#f5f5f5]">{variable.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        variable.assigned
                          ? "bg-green-500/20 text-green-400"
                          : "bg-[#1a1025] text-[#a1a1aa]"
                      }`}>
                        {variable.assigned ? "Asignada" : "Sin asignar"}
                      </span>
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
                    templateId={activeTemplate?.id ?? ""}
                    xlsxTemplateId={activeXlsxTemplate?.id}
                    assignedVariables={availableVariables
                      .filter((v) => v.assigned)
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
    </main>
  );
}
