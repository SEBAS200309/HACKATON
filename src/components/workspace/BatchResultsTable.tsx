"use client";

import React, { useState, useCallback, useRef } from "react";
import type { WorkspacePage, Variable } from "@/types";

export interface BatchResultsTableProps {
  pages: WorkspacePage[];
  variables: Variable[];
  onUpdateRecord: (pageId: string, variableName: string, value: string) => void;
}

const statusDotColors: Record<WorkspacePage["status"], string> = {
  pending: "#a1a1aa",
  processing: "#eab308",
  completed: "#22c55e",
  error: "#ef4444",
};

const statusLabels: Record<WorkspacePage["status"], string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  error: "Error",
};

function isRowComplete(
  page: WorkspacePage,
  variables: Variable[]
): boolean {
  const assignedVariables = variables.filter((v) => v.assigned);
  if (assignedVariables.length === 0) return false;
  return assignedVariables.every(
    (v) => (page.record[v.name] ?? "").trim() !== ""
  );
}

interface EditableCellProps {
  pageId: string;
  variableName: string;
  value: string;
  onUpdateRecord: (pageId: string, variableName: string, value: string) => void;
}

function EditableCell({
  pageId,
  variableName,
  value,
  onUpdateRecord,
}: EditableCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onUpdateRecord(pageId, variableName, localValue);
    }
  }, [localValue, value, pageId, variableName, onUpdateRecord]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    []
  );

  // Sync local value when prop changes externally
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="
        w-full bg-transparent border-0 outline-none
        text-sm text-[#f5f5f5] px-2 py-1.5
        focus:bg-[#1a1025] focus:ring-1 focus:ring-[#a855f7] focus:rounded
        transition-all duration-150
        placeholder:text-[#a1a1aa]/50
      "
      placeholder="—"
      aria-label={`${variableName} - valor`}
    />
  );
}

export default function BatchResultsTable({
  pages,
  variables,
  onUpdateRecord,
}: BatchResultsTableProps) {
  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-purple-500/20 bg-[#0f0a1a] p-8 text-center">
        <p className="text-sm text-[#a1a1aa]">
          No hay registros para mostrar
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-500/20 bg-[#0f0a1a] overflow-x-auto">
      <table className="w-full text-sm" role="grid" aria-label="Tabla de resultados por lote">
        {/* Header */}
        <thead>
          <tr className="bg-[#1a1025] border-b border-purple-500/20">
            <th
              className="px-3 py-2.5 text-left text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider whitespace-nowrap"
              scope="col"
            >
              Pág.
            </th>
            {variables.map((variable) => (
              <th
                key={variable.name}
                className="px-3 py-2.5 text-left text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider whitespace-nowrap"
                scope="col"
              >
                {variable.name}
              </th>
            ))}
            <th
              className="px-3 py-2.5 text-left text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider whitespace-nowrap"
              scope="col"
            >
              Estado
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {pages.map((page, index) => {
            const complete = isRowComplete(page, variables);
            const isEvenRow = index % 2 === 0;

            return (
              <tr
                key={page.id}
                className={`
                  border-b border-purple-500/10 last:border-b-0
                  ${isEvenRow ? "bg-[#0f0a1a]" : "bg-[#0f0a1a]/60"}
                  hover:bg-[#1a1025]/50 transition-colors duration-100
                `}
              >
                {/* Page number + status dot */}
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusDotColors[page.status] }}
                      title={statusLabels[page.status]}
                      aria-label={statusLabels[page.status]}
                    />
                    <span className="text-sm font-medium text-[#f5f5f5]">
                      {page.pageNumber}
                    </span>
                  </div>
                </td>

                {/* Variable cells - editable */}
                {variables.map((variable) => (
                  <td key={`${page.id}-${variable.name}`} className="px-1 py-0.5">
                    <EditableCell
                      pageId={page.id}
                      variableName={variable.name}
                      value={page.record[variable.name] ?? ""}
                      onUpdateRecord={onUpdateRecord}
                    />
                  </td>
                ))}

                {/* Completeness indicator */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {complete ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      <span aria-hidden="true">✓</span>
                      Completo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400">
                      Incompleto
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
