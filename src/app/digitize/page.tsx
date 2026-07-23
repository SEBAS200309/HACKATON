"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { DocumentCapture } from "@/components/digitization";
import { AreaEditor } from "@/components/digitization";
import { OcrResultsPanel } from "@/components/digitization";
import { DownloadPanel } from "@/components/digitization";
import { Button, LoadingSpinner } from "@/components/ui";
import type { TemplateMetadata, Variable, SegmentationConfig } from "@/types";

const STEPS = [
  "Seleccionar plantilla",
  "Capturar documento",
  "Definir áreas",
  "Procesando OCR",
  "Revisar resultados",
  "Descargar",
];

// ─── Progress Stepper Component ───────────────────────────────────────────────
function ProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Progreso de digitalización" className="w-full mb-6">
      <ol className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li key={label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center w-full">
                <div
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-full
                    text-xs font-semibold transition-colors duration-200
                    ${isCurrent
                      ? "bg-[#a855f7] text-white ring-2 ring-[#c084fc] ring-offset-2 ring-offset-[#0f0a1a]"
                      : isCompleted
                        ? "bg-[#a855f7]/80 text-white"
                        : "bg-[#1a1025] text-[#a1a1aa] border border-[#a1a1aa]/30"
                    }
                  `}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1 text-[0.65rem] text-center leading-tight truncate w-full
                    ${isCurrent ? "text-[#a855f7] font-medium" : "text-[#a1a1aa]"}
                  `}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 min-w-[0.75rem] rounded ${
                    index < currentStep ? "bg-[#a855f7]" : "bg-[#1a1025]"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Template Selector Component ──────────────────────────────────────────────
interface TemplateSelectorProps {
  wordTemplates: TemplateMetadata[];
  xlsxTemplates: TemplateMetadata[];
  selectedWord: TemplateMetadata | null;
  selectedXlsx: TemplateMetadata | null;
  onSelectWord: (t: TemplateMetadata | null) => void;
  onSelectXlsx: (t: TemplateMetadata | null) => void;
}

function TemplateSelector({
  wordTemplates,
  xlsxTemplates,
  selectedWord,
  selectedXlsx,
  onSelectWord,
  onSelectXlsx,
}: TemplateSelectorProps) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-lg mx-auto">
      {/* Word template (required) */}
      <div>
        <label
          htmlFor="word-template-select"
          className="block text-sm font-medium text-[#f5f5f5] mb-2"
        >
          Plantilla Word (.docx) <span className="text-red-400">*</span>
        </label>
        <select
          id="word-template-select"
          value={selectedWord?.id || ""}
          onChange={(e) => {
            const t = wordTemplates.find((wt) => wt.id === e.target.value) || null;
            onSelectWord(t);
            if (!t) onSelectXlsx(null);
          }}
          className="w-full rounded-lg border border-[#a1a1aa]/30 bg-[#1a1025] px-4 py-2.5
            text-sm text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-[#a855f7]
            focus:border-[#a855f7] transition-colors"
        >
          <option value="">Seleccione una plantilla Word...</option>
          {wordTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fileName} ({t.placeholders.length} variables)
            </option>
          ))}
        </select>
      </div>

      {/* XLSX template (optional, shown after Word selected) */}
      {selectedWord && xlsxTemplates.length > 0 && (
        <div>
          <label
            htmlFor="xlsx-template-select"
            className="block text-sm font-medium text-[#f5f5f5] mb-2"
          >
            Plantilla Excel (.xlsx) <span className="text-[#a1a1aa]">(opcional)</span>
          </label>
          <select
            id="xlsx-template-select"
            value={selectedXlsx?.id || ""}
            onChange={(e) => {
              const t = xlsxTemplates.find((xt) => xt.id === e.target.value) || null;
              onSelectXlsx(t);
            }}
            className="w-full rounded-lg border border-[#a1a1aa]/30 bg-[#1a1025] px-4 py-2.5
              text-sm text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-[#a855f7]
              focus:border-[#a855f7] transition-colors"
          >
            <option value="">Sin plantilla Excel</option>
            {xlsxTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fileName} ({t.placeholders.length} variables)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Template info */}
      {selectedWord && (
        <div className="rounded-lg border border-[#a855f7]/20 bg-[#1a1025] p-4">
          <h4 className="text-sm font-medium text-[#f5f5f5] mb-2">
            Variables de la plantilla
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedWord.placeholders.map((p) => (
              <span
                key={p}
                className="inline-block rounded-full bg-[#a855f7]/10 px-3 py-1 text-xs text-[#c084fc]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Digitize Page ───────────────────────────────────────────────────────
export default function DigitizePage() {
  const router = useRouter();

  // Store state
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const currentStep = useAppStore((s) => s.currentStep);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const wordTemplates = useAppStore((s) => s.wordTemplates);
  const xlsxTemplates = useAppStore((s) => s.xlsxTemplates);
  const loadTemplates = useAppStore((s) => s.loadTemplates);
  const selectedWordTemplate = useAppStore((s) => s.selectedWordTemplate);
  const selectedXlsxTemplate = useAppStore((s) => s.selectedXlsxTemplate);
  const setSelectedWordTemplate = useAppStore((s) => s.setSelectedWordTemplate);
  const setSelectedXlsxTemplate = useAppStore((s) => s.setSelectedXlsxTemplate);
  const currentDocument = useAppStore((s) => s.currentDocument);
  const setCurrentDocument = useAppStore((s) => s.setCurrentDocument);
  const areas = useAppStore((s) => s.areas);
  const setAreas = useAppStore((s) => s.setAreas);
  const ocrResults = useAppStore((s) => s.ocrResults);
  const setOcrResults = useAppStore((s) => s.setOcrResults);
  const editedValues = useAppStore((s) => s.editedValues);
  const setEditedValue = useAppStore((s) => s.setEditedValue);
  const loading = useAppStore((s) => s.loading);
  const setLoading = useAppStore((s) => s.setLoading);
  const addToast = useAppStore((s) => s.addToast);
  const resetDigitization = useAppStore((s) => s.resetDigitization);

  // Local state for download step
  const [isGenerating, setIsGenerating] = useState(false);
  const [docxDownloadUrl, setDocxDownloadUrl] = useState<string | null>(null);
  const [xlsxDownloadUrl, setXlsxDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Load templates on mount
  useEffect(() => {
    if (isAuthenticated && wordTemplates.length === 0) {
      loadTemplates();
    }
  }, [isAuthenticated, wordTemplates.length, loadTemplates]);

  // Derive available variables from selected Word template
  const availableVariables: Variable[] = useMemo(() => {
    if (!selectedWordTemplate) return [];
    const xlsxPlaceholders = selectedXlsxTemplate?.placeholders || [];
    return selectedWordTemplate.placeholders.map((name) => ({
      name,
      source: xlsxPlaceholders.includes(name) ? "both" as const : "word" as const,
      assigned: areas.some((a) => a.variableName === name),
    }));
  }, [selectedWordTemplate, selectedXlsxTemplate, areas]);

  // Validate step 2→3: at least 1 area with a valid variableName
  const canProceedToOcr = useMemo(() => {
    return areas.some((a) => a.variableName.trim() !== "");
  }, [areas]);

  // ─── Step Handlers ────────────────────────────────────────────────────────
  const handleDocumentReady = useCallback(
    (url: string, s3Key: string) => {
      setCurrentDocument({ url, s3Key });
      setCurrentStep(2);
    },
    [setCurrentDocument, setCurrentStep]
  );

  const handleDocumentRetake = useCallback(() => {
    setCurrentDocument(null);
  }, [setCurrentDocument]);

  const handleAreasChange = useCallback(
    (newAreas: typeof areas) => {
      setAreas(newAreas);
    },
    [setAreas]
  );

  const handleSaveConfiguration = useCallback(
    (_config: SegmentationConfig) => {
      addToast({ type: "success", message: "Configuración guardada exitosamente" });
    },
    [addToast]
  );

  // Process OCR (step 3)
  const processOcr = useCallback(async () => {
    if (!currentDocument) return;
    setCurrentStep(3);
    setLoading(true);

    try {
      const response = await fetch("/api/ocr/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: currentDocument.s3Key,
          areas: areas.filter((a) => a.variableName.trim() !== ""),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg = data?.error?.message || "Error al procesar OCR";
        addToast({ type: "error", message: msg });
        setCurrentStep(2);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOcrResults(data.results || []);
      setCurrentStep(4);
    } catch {
      addToast({ type: "error", message: "Error de conexión al procesar OCR" });
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  }, [currentDocument, areas, setCurrentStep, setLoading, addToast, setOcrResults]);

  // Handle field edit in OCR results
  const handleFieldEdit = useCallback(
    (variableName: string, newValue: string) => {
      setEditedValue(variableName, newValue);
      // Also update ocrResults so the panel reflects the change
      const updated = ocrResults.map((r) =>
        r.variableName === variableName ? { ...r, extractedText: newValue } : r
      );
      setOcrResults(updated);
    },
    [ocrResults, setEditedValue, setOcrResults]
  );

  // Handle approve → generate document (step 4→5)
  const handleApprove = useCallback(() => {
    setCurrentStep(5);
  }, [setCurrentStep]);

  // Generate document
  const handleGenerate = useCallback(async () => {
    if (!selectedWordTemplate || !currentDocument) return;
    setIsGenerating(true);
    setDownloadError(null);

    // Build variables map from edited values or OCR results
    const variables: Record<string, string> = {};
    for (const result of ocrResults) {
      variables[result.variableName] =
        editedValues[result.variableName] ?? result.extractedText;
    }

    try {
      const response = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedWordTemplate.id,
          xlsxTemplateId: selectedXlsxTemplate?.id || undefined,
          variables,
          sourceDocumentKey: currentDocument.s3Key,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setDownloadError(data?.error?.message || "Error al generar documento");
        setIsGenerating(false);
        return;
      }

      const data = await response.json();
      setDocxDownloadUrl(data.docxDownloadUrl);
      setXlsxDownloadUrl(data.xlsxDownloadUrl || null);
      setDownloadFilename(data.filename || "documento-generado.docx");
    } catch {
      setDownloadError("Error de conexión al generar documento");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedWordTemplate, selectedXlsxTemplate, currentDocument, ocrResults, editedValues]);

  // Retry generate
  const handleRetryGenerate = useCallback(() => {
    setDownloadError(null);
    handleGenerate();
  }, [handleGenerate]);

  // New digitization flow
  const handleNewDigitization = useCallback(() => {
    resetDigitization();
    setDocxDownloadUrl(null);
    setXlsxDownloadUrl(null);
    setDownloadFilename("");
    setDownloadError(null);
  }, [resetDigitization]);

  // ─── Auth check ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return null;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0f0a1a] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">
            Digitalización de Documento
          </h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleNewDigitization}
          >
            Nueva digitalización
          </Button>
        </div>

        {/* Progress Stepper */}
        <ProgressStepper currentStep={currentStep} />

        {/* Step Content */}
        <div className="rounded-xl border border-[#a855f7]/10 bg-[#1a1025]/50 p-4 sm:p-6">
          {/* Step 0: Template Selection */}
          {currentStep === 0 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-semibold text-[#f5f5f5]">
                Seleccionar plantillas
              </h2>
              {loading ? (
                <LoadingSpinner message="Cargando plantillas..." />
              ) : (
                <>
                  <TemplateSelector
                    wordTemplates={wordTemplates}
                    xlsxTemplates={xlsxTemplates}
                    selectedWord={selectedWordTemplate}
                    selectedXlsx={selectedXlsxTemplate}
                    onSelectWord={setSelectedWordTemplate}
                    onSelectXlsx={setSelectedXlsxTemplate}
                  />
                  <div className="flex justify-end pt-4">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!selectedWordTemplate}
                      onClick={() => setCurrentStep(1)}
                    >
                      Continuar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 1: Document Capture */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#f5f5f5]">
                  Capturar documento fuente
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentStep(0)}
                >
                  Atrás
                </Button>
              </div>
              <DocumentCapture
                onDocumentReady={handleDocumentReady}
                onRetake={handleDocumentRetake}
              />
            </div>
          )}

          {/* Step 2: Area Editor */}
          {currentStep === 2 && currentDocument && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#f5f5f5]">
                  Definir áreas de interés
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                >
                  Atrás
                </Button>
              </div>
              <AreaEditor
                documentUrl={currentDocument.url}
                availableVariables={availableVariables}
                existingAreas={areas}
                onAreasChange={handleAreasChange}
                onSaveConfiguration={handleSaveConfiguration}
                templateId={selectedWordTemplate?.id}
              />
              <div className="flex justify-end pt-4 border-t border-[#a1a1aa]/10">
                <Button
                  variant="primary"
                  size="md"
                  disabled={!canProceedToOcr}
                  onClick={processOcr}
                >
                  Procesar OCR
                </Button>
              </div>
              {!canProceedToOcr && areas.length > 0 && (
                <p className="text-xs text-[#a1a1aa] text-right">
                  Asigne al menos una variable a un área para continuar
                </p>
              )}
            </div>
          )}

          {/* Step 3: OCR Processing (loading state) */}
          {currentStep === 3 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner size="lg" message="Procesando OCR con AWS Textract..." />
              <p className="text-sm text-[#a1a1aa]">
                Esto puede tomar unos segundos dependiendo del tamaño del documento
              </p>
            </div>
          )}

          {/* Step 4: Review OCR Results */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#f5f5f5]">
                  Revisar y editar resultados
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                >
                  Volver a áreas
                </Button>
              </div>
              <OcrResultsPanel
                results={ocrResults}
                onFieldEdit={handleFieldEdit}
                onApprove={handleApprove}
                documentUrl={currentDocument?.url}
                areas={areas}
              />
            </div>
          )}

          {/* Step 5: Download */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-[#f5f5f5]">
                Descargar documentos generados
              </h2>
              <DownloadPanel
                isGenerating={isGenerating}
                docxDownloadUrl={docxDownloadUrl}
                xlsxDownloadUrl={xlsxDownloadUrl}
                filename={downloadFilename}
                hasXlsxTemplate={!!selectedXlsxTemplate}
                error={downloadError}
                onRetry={handleRetryGenerate}
                onGenerate={handleGenerate}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
