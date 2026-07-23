"use client";

import React, { useState, useCallback, useMemo } from "react";
import type { OcrResult, AreaOfInterest } from "@/types";
import Button from "@/components/ui/Button";

export interface OcrResultsPanelProps {
  results: OcrResult[];
  onFieldEdit: (variableName: string, newValue: string) => void;
  onApprove: () => void;
  documentUrl?: string;
  areas?: AreaOfInterest[];
  onVariableClick?: (variableName: string) => void;
  highlightedVariable?: string | null;
}

/**
 * Determina la clase de borde según el nivel de confianza y el texto extraído.
 * - Rojo: confianza 0% o texto vacío (crítico)
 * - Ámbar: confianza >0% pero <80% (advertencia)
 * - Normal: confianza ≥80%
 */
function getConfidenceBorderClass(confidence: number, text: string): string {
  if (confidence === 0 || text.trim() === "") {
    return "border-red-500";
  }
  if (confidence > 0 && confidence < 80) {
    return "border-amber-500";
  }
  return "border-gray-600";
}

/**
 * Devuelve un label y color para el indicador de confianza.
 */
function getConfidenceIndicator(confidence: number, text: string): { label: string; colorClass: string } {
  if (confidence === 0 || text.trim() === "") {
    return { label: "Crítico", colorClass: "text-red-500" };
  }
  if (confidence > 0 && confidence < 80) {
    return { label: "Advertencia", colorClass: "text-amber-500" };
  }
  return { label: "Normal", colorClass: "text-green-500" };
}

export default function OcrResultsPanel({
  results,
  onFieldEdit,
  onApprove,
  documentUrl,
  areas = [],
  onVariableClick,
  highlightedVariable,
}: OcrResultsPanelProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleApprove = useCallback(() => {
    const hasEmptyFields = results.some((r) => r.extractedText.trim() === "");
    if (hasEmptyFields) {
      setValidationError(
        "Existen campos vacíos o inválidos. Revise los campos marcados antes de aprobar"
      );
      return;
    }
    setValidationError(null);
    onApprove();
  }, [results, onApprove]);

  const handleFieldChange = useCallback(
    (variableName: string, newValue: string) => {
      if (validationError) {
        setValidationError(null);
      }
      onFieldEdit(variableName, newValue);
    },
    [onFieldEdit, validationError]
  );

  const handleVariableClick = useCallback(
    (variableName: string) => {
      if (onVariableClick) {
        onVariableClick(variableName);
      }
    },
    [onVariableClick]
  );

  // Mapear áreas por nombre de variable para renderizar overlays
  const areasByVariable = useMemo(() => {
    const map = new Map<string, AreaOfInterest>();
    for (const area of areas) {
      map.set(area.variableName, area);
    }
    return map;
  }, [areas]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Lado izquierdo: documento fuente con áreas destacadas */}
      {documentUrl && (
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">
            Documento fuente
          </h3>
          <div className="relative rounded-lg border border-gray-700 overflow-hidden bg-dark-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={documentUrl}
              alt="Documento fuente para OCR"
              className="w-full h-auto block"
            />
            {/* Overlays de áreas de interés */}
            {areas.map((area) => {
              const isHighlighted = highlightedVariable === area.variableName;
              return (
                <div
                  key={area.id}
                  className={`absolute border-2 transition-all duration-200 cursor-pointer ${
                    isHighlighted
                      ? "border-purple-400 ring-2 ring-purple-400 animate-pulse"
                      : "border-opacity-60"
                  }`}
                  style={{
                    left: `${area.x * 100}%`,
                    top: `${area.y * 100}%`,
                    width: `${area.width * 100}%`,
                    height: `${area.height * 100}%`,
                    borderColor: isHighlighted ? undefined : area.color,
                  }}
                  onClick={() => handleVariableClick(area.variableName)}
                  title={area.variableName}
                  role="button"
                  aria-label={`Área: ${area.variableName}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Lado derecho: panel de resultados OCR */}
      <div
        className={`flex-1 min-w-0 ${
          documentUrl ? "" : "w-full"
        }`}
      >
        <h3 className="text-sm font-semibold text-gray-200 mb-2">
          Resultados OCR
        </h3>

        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {results.map((result) => {
            const borderClass = getConfidenceBorderClass(
              result.confidence,
              result.extractedText
            );
            const indicator = getConfidenceIndicator(
              result.confidence,
              result.extractedText
            );
            const isHighlighted = highlightedVariable === result.variableName;

            return (
              <div
                key={result.variableName}
                className={`rounded-lg p-3 bg-dark-secondary transition-all duration-200 ${
                  isHighlighted ? "ring-2 ring-purple-400" : ""
                }`}
              >
                {/* Encabezado: nombre de variable + indicadores */}
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    type="button"
                    className="text-sm font-medium text-gray-200 hover:text-purple-400 transition-colors cursor-pointer text-left"
                    onClick={() => handleVariableClick(result.variableName)}
                    aria-label={`Seleccionar variable ${result.variableName}`}
                  >
                    {result.variableName}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${indicator.colorClass}`}>
                      {result.confidence}%
                    </span>
                    <span className="text-xs text-gray-500">
                      {result.wordCount} {result.wordCount === 1 ? "palabra" : "palabras"}
                    </span>
                  </div>
                </div>

                {/* Campo editable */}
                <textarea
                  value={result.extractedText}
                  onChange={(e) =>
                    handleFieldChange(result.variableName, e.target.value)
                  }
                  className={`
                    w-full px-3 py-2 rounded-lg text-sm
                    bg-dark-bg border-2
                    text-gray-100 placeholder-gray-500
                    transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary
                    resize-y min-h-[2.5rem]
                    ${borderClass}
                  `.trim()}
                  rows={1}
                  aria-label={`Texto extraído para ${result.variableName}`}
                  aria-invalid={
                    result.confidence === 0 || result.extractedText.trim() === ""
                  }
                />

                {/* Indicador de severidad debajo del campo */}
                {(result.confidence === 0 || result.extractedText.trim() === "") && (
                  <p className="text-xs text-red-500 mt-1">
                    Campo vacío o sin confianza — requiere revisión
                  </p>
                )}
                {result.confidence > 0 && result.confidence < 80 && result.extractedText.trim() !== "" && (
                  <p className="text-xs text-amber-500 mt-1">
                    Confianza baja — verifique el texto
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Mensaje de error de validación */}
        {validationError && (
          <div
            className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400"
            role="alert"
          >
            {validationError}
          </div>
        )}

        {/* Botón de aprobar */}
        <div className="mt-4 pt-3 border-t border-gray-700">
          <Button
            variant="primary"
            size="md"
            onClick={handleApprove}
            className="w-full"
          >
            Aprobar resultados
          </Button>
        </div>
      </div>
    </div>
  );
}
