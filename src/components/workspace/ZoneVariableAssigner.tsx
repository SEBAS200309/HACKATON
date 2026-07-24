"use client";

import React from "react";
import type { Variable } from "@/types";
import Modal from "@/components/ui/Modal";

export interface ZoneVariableAssignerProps {
  isOpen: boolean;
  availableVariables: Variable[];
  assignedVariableNames: string[];
  onAssign: (variableName: string) => void;
  onCancel: () => void;
}

function getSourceLabel(source: Variable["source"]): string {
  switch (source) {
    case "word":
      return "Word";
    case "xlsx":
      return "Excel";
    case "both":
      return "Ambos";
  }
}

function getSourceBadgeClasses(source: Variable["source"]): string {
  switch (source) {
    case "word":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "xlsx":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "both":
      return "bg-purple-primary/20 text-purple-light border-purple-primary/30";
  }
}

export default function ZoneVariableAssigner({
  isOpen,
  availableVariables,
  assignedVariableNames,
  onAssign,
  onCancel,
}: ZoneVariableAssignerProps) {
  const isAssigned = (variableName: string): boolean =>
    assignedVariableNames.includes(variableName);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Asignar variable">
      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
        {availableVariables.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No hay variables disponibles en la plantilla activa.
          </p>
        ) : (
          <ul className="flex flex-col gap-1" role="listbox" aria-label="Variables disponibles">
            {availableVariables.map((variable) => {
              const assigned = isAssigned(variable.name);

              return (
                <li key={variable.name} role="option" aria-selected={assigned}>
                  <button
                    type="button"
                    onClick={() => onAssign(variable.name)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                      transition-colors text-left
                      ${
                        assigned
                          ? "opacity-60 hover:opacity-80 hover:bg-purple-primary/5"
                          : "hover:bg-purple-primary/10"
                      }
                    `.trim()}
                    aria-label={`Asignar variable ${variable.name}${assigned ? " (ya asignada)" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-sm font-medium truncate ${
                          assigned ? "text-gray-500" : "text-gray-100"
                        }`}
                      >
                        {variable.name}
                      </span>
                      <span
                        className={`
                          inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium
                          rounded border ${getSourceBadgeClasses(variable.source)}
                        `.trim()}
                      >
                        {getSourceLabel(variable.source)}
                      </span>
                    </div>

                    <span
                      className={`
                        inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full
                        ${
                          assigned
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
                        }
                      `.trim()}
                    >
                      {assigned ? "Asignada" : "Sin asignar"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer with cancel button */}
      <div className="flex justify-end pt-3 mt-3 border-t border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="
            px-4 py-2 text-sm font-medium text-gray-300
            bg-dark-bg border border-gray-700 rounded-lg
            hover:bg-gray-800 hover:text-gray-100
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-purple-primary/50
          "
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
