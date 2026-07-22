"use client";

import React, { useCallback, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";
import { formatFileSize, formatDate } from "@/utils/format";
import type { TemplateMetadata } from "@/types";

interface WordTemplateListProps {
  templates: TemplateMetadata[];
  onDelete: (id: string) => void;
}

export default function WordTemplateList({
  templates,
  onDelete,
}: WordTemplateListProps) {
  const [deleteTarget, setDeleteTarget] = useState<TemplateMetadata | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const addToast = useAppStore((s) => s.addToast);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/templates/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        addToast({
          type: "error",
          message: data?.error?.message || "Error al eliminar la plantilla",
        });
        return;
      }

      addToast({ type: "success", message: "Plantilla eliminada exitosamente" });
      onDelete(deleteTarget.id);
    } catch {
      addToast({
        type: "error",
        message: "Error al eliminar la plantilla. Intente nuevamente",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, addToast, onDelete]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (templates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No hay plantillas Word cargadas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <article
          key={template.id}
          className="bg-dark-surface border border-gray-800 rounded-lg p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-100 truncate">
                {template.fileName}
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="text-xs text-gray-500">
                  {formatDate(template.uploadDate)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatFileSize(template.fileSize)}
                </span>
                <span className="text-xs text-gray-400">
                  {template.placeholders.length} variable
                  {template.placeholders.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {template.placeholders.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleExpand(template.id)}
                  aria-expanded={expandedId === template.id}
                  aria-controls={`placeholders-${template.id}`}
                >
                  {expandedId === template.id ? "Ocultar" : "Ver variables"}
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteTarget(template)}
                aria-label={`Eliminar plantilla ${template.fileName}`}
              >
                Eliminar
              </Button>
            </div>
          </div>

          {/* Expandable placeholders list */}
          {expandedId === template.id && template.placeholders.length > 0 && (
            <div
              id={`placeholders-${template.id}`}
              className="mt-3 pt-3 border-t border-gray-800"
            >
              <p className="text-xs text-gray-500 mb-2">
                Variables detectadas:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.placeholders.map((placeholder) => (
                  <span
                    key={placeholder}
                    className="inline-block px-2 py-0.5 text-xs rounded bg-purple-primary/15 text-purple-light border border-purple-primary/30"
                  >
                    {`{{${placeholder}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar eliminación"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-300">
            ¿Está seguro de que desea eliminar la plantilla{" "}
            <strong className="text-gray-100">
              &quot;{deleteTarget?.fileName}&quot;
            </strong>
            ?
          </p>
          <p className="text-xs text-gray-500">
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              loading={deleting}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
