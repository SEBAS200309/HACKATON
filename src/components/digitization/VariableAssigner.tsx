"use client";

import React, { useState } from "react";
import type { Variable } from "@/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export interface VariableAssignerProps {
  isOpen: boolean;
  availableVariables: Variable[];
  onAssign: (variableName: string) => void;
  onCancel: () => void;
}

const VARIABLE_NAME_REGEX = /^[a-zA-Z0-9_]+$/;

export default function VariableAssigner({
  isOpen,
  availableVariables,
  onAssign,
  onCancel,
}: VariableAssignerProps) {
  const [variableName, setVariableName] = useState("");
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setVariableName(value);
    if (error) setError("");
  };

  const handleAssign = () => {
    const trimmed = variableName.trim();

    if (!trimmed) {
      setError("El nombre de la variable es requerido");
      return;
    }

    if (!VARIABLE_NAME_REGEX.test(trimmed)) {
      setError("Solo se permiten caracteres alfanuméricos y guiones bajos");
      return;
    }

    setVariableName("");
    setError("");
    onAssign(trimmed);
  };

  const handleQuickSelect = (name: string) => {
    setVariableName(name);
    setError("");
  };

  const handleCancel = () => {
    setVariableName("");
    setError("");
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAssign();
    }
  };

  const unassignedVariables = availableVariables.filter((v) => !v.assigned);
  const assignedVariables = availableVariables.filter((v) => v.assigned);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Asignar variable al área"
    >
      <div className="flex flex-col gap-4">
        {/* Name input */}
        <div onKeyDown={handleKeyDown}>
          <Input
            label="Nombre de la variable"
            value={variableName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="nombre_variable"
            error={error}
            required
            autoFocus
          />
        </div>

        {/* Available variables quick-select */}
        {unassignedVariables.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-400 mb-2">
              Variables disponibles:
            </p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {unassignedVariables.map((variable) => (
                <button
                  key={variable.name}
                  type="button"
                  onClick={() => handleQuickSelect(variable.name)}
                  className={`
                    px-2.5 py-1 text-xs rounded-md border transition-colors
                    ${
                      variableName === variable.name
                        ? "border-purple-primary bg-purple-primary/20 text-purple-light"
                        : "border-gray-600 bg-dark-bg text-gray-300 hover:border-gray-500 hover:text-gray-100"
                    }
                  `.trim()}
                  aria-label={`Seleccionar variable ${variable.name}`}
                >
                  {variable.name}
                  <span className="ml-1 text-gray-500">
                    ({variable.source})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Already assigned variables (greyed out) */}
        {assignedVariables.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">
              Ya asignadas:
            </p>
            <div className="flex flex-wrap gap-2">
              {assignedVariables.map((variable) => (
                <span
                  key={variable.name}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-700 bg-dark-bg text-gray-500 line-through"
                >
                  {variable.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAssign}
            disabled={!variableName.trim()}
          >
            Asignar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
