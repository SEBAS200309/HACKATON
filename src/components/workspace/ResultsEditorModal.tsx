"use client";

import React, { useState, useCallback, useEffect } from "react";
import type { WorkspacePage, Variable } from "@/types";

export interface ResultsEditorModalProps {
  pages: WorkspacePage[];
  variables: Variable[];
  onSave: (updatedPages: WorkspacePage[]) => void;
  onClose: () => void;
}

interface EditingCell {
  pageId: string;
  recIdx: number | null; // null = single record mode
  variableName: string;
  value: string;
}

export default function ResultsEditorModal({
  pages,
  variables,
  onSave,
  onClose,
}: ResultsEditorModalProps) {
  // Copia local editable de las páginas
  const [localPages, setLocalPages] = useState<WorkspacePage[]>(() =>
    JSON.parse(JSON.stringify(pages))
  );
  // Historial para deshacer
  const [history, setHistory] = useState<WorkspacePage[][]>([]);
  // Celda en edición
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");

  // Sincronizar si las props cambian
  useEffect(() => {
    setLocalPages(JSON.parse(JSON.stringify(pages)));
    setHistory([]);
  }, [pages]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(localPages))]);
  }, [localPages]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setLocalPages(prev);
  }, [history]);

  // Abrir editor de celda
  const openCellEditor = useCallback(
    (pageId: string, recIdx: number | null, variableName: string, currentValue: string) => {
      setEditingCell({ pageId, recIdx, variableName, value: currentValue });
      setEditValue(currentValue);
    },
    []
  );

  // Confirmar edición de celda
  const confirmCellEdit = useCallback(() => {
    if (!editingCell) return;
    pushHistory();

    setLocalPages((prev) =>
      prev.map((p) => {
        if (p.id !== editingCell.pageId) return p;

        if (editingCell.recIdx !== null && p.records) {
          // Multi-record: editar dentro del array
          const newRecords = [...p.records];
          if (newRecords[editingCell.recIdx]) {
            newRecords[editingCell.recIdx] = {
              ...newRecords[editingCell.recIdx],
              [editingCell.variableName]: editValue,
            };
          }
          return { ...p, records: newRecords };
        } else {
          // Single record
          return { ...p, record: { ...p.record, [editingCell.variableName]: editValue } };
        }
      })
    );
    setEditingCell(null);
  }, [editingCell, editValue, pushHistory]);

  // Cancelar edición
  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Eliminar un registro multi-record
  const deleteMultiRecord = useCallback(
    (pageId: string, recIdx: number) => {
      pushHistory();
      setLocalPages((prev) =>
        prev.map((p) => {
          if (p.id !== pageId || !p.records) return p;
          const newRecords = p.records.filter((_, i) => i !== recIdx);
          return { ...p, records: newRecords.length > 0 ? newRecords : undefined };
        })
      );
    },
    [pushHistory]
  );

  // Eliminar registro de página (single record: limpiar record)
  const clearPageRecord = useCallback(
    (pageId: string) => {
      pushHistory();
      setLocalPages((prev) =>
        prev.map((p) => {
          if (p.id !== pageId) return p;
          const emptyRecord: Record<string, string> = {};
          for (const v of variables) {
            emptyRecord[v.name] = "";
          }
          return { ...p, record: emptyRecord, records: undefined, ocrProcessed: false, status: "pending" };
        })
      );
    },
    [pushHistory, variables]
  );

  const handleSave = useCallback(() => {
    onSave(localPages);
    onClose();
  }, [localPages, onSave, onClose]);

  const assignedVars = variables.filter((v) => v.assigned);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1025] border border-purple-500/30 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/20">
          <h3 className="text-sm font-semibold text-[#f5f5f5]">
            Editar Resultados OCR
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-600 text-[#a1a1aa] hover:text-[#f5f5f5] hover:border-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Deshacer último cambio"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Deshacer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[#a1a1aa] hover:text-[#f5f5f5] transition-colors"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-auto p-4">
          {localPages.map((page) => {
            const hasMulti = page.records && page.records.length > 0;

            return (
              <div key={page.id} className="mb-4 last:mb-0">
                {/* Page header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#a1a1aa]">
                    Página {page.pageNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearPageRecord(page.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Limpiar todo
                  </button>
                </div>

                {/* Multi-record rows */}
                {hasMulti ? (
                  <div className="space-y-1.5">
                    {page.records!.map((rec, recIdx) => (
                      <div
                        key={`${page.id}-${recIdx}`}
                        className="flex items-start gap-2 rounded-lg border border-purple-500/10 bg-[#0f0a1a] p-2"
                      >
                        <span className="text-[10px] text-[#a1a1aa] pt-1 shrink-0 w-6">
                          {recIdx + 1}
                        </span>
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {assignedVars.map((v) => (
                            <button
                              key={v.name}
                              type="button"
                              onClick={() => openCellEditor(page.id, recIdx, v.name, rec[v.name] ?? "")}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-[#1a1025] border border-purple-500/20 hover:border-purple-400 transition-colors text-left max-w-[200px]"
                              title={`Editar ${v.name}`}
                            >
                              <span className="text-[#a1a1aa] shrink-0">{v.name}:</span>
                              <span className="text-[#f5f5f5] truncate">
                                {rec[v.name] || "—"}
                              </span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteMultiRecord(page.id, recIdx)}
                          className="p-1 text-[#a1a1aa] hover:text-red-400 transition-colors shrink-0"
                          title="Eliminar registro"
                          aria-label={`Eliminar registro ${recIdx + 1}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Single record */
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-purple-500/10 bg-[#0f0a1a] p-2">
                    {assignedVars.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => openCellEditor(page.id, null, v.name, page.record[v.name] ?? "")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-[#1a1025] border border-purple-500/20 hover:border-purple-400 transition-colors text-left max-w-[200px]"
                        title={`Editar ${v.name}`}
                      >
                        <span className="text-[#a1a1aa] shrink-0">{v.name}:</span>
                        <span className="text-[#f5f5f5] truncate">
                          {page.record[v.name] || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-purple-500/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg border border-gray-600 text-[#a1a1aa] hover:text-[#f5f5f5] hover:border-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {/* Sub-modal: editor de celda individual */}
      {editingCell && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#1a1025] border border-purple-500/30 rounded-xl w-full max-w-sm p-4">
            <p className="text-xs text-[#a1a1aa] mb-2">
              Editando: <span className="text-[#f5f5f5] font-medium">{editingCell.variableName}</span>
            </p>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmCellEdit();
                if (e.key === "Escape") cancelCellEdit();
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#0f0a1a] border border-purple-500/30 text-sm text-[#f5f5f5] outline-none focus:border-purple-500 transition-colors"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={cancelCellEdit}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cancelar"
                aria-label="Cancelar edición"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                type="button"
                onClick={confirmCellEdit}
                className="p-1.5 rounded-md text-green-400 hover:bg-green-500/10 transition-colors"
                title="Confirmar"
                aria-label="Confirmar edición"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
