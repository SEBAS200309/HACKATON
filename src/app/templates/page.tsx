"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui";
import {
  TemplateUploader,
  WordTemplateList,
  XlsxTemplateList,
} from "@/components/templates";
import { useAppStore } from "@/store/useAppStore";
import type { TemplateMetadata } from "@/types";

export default function TemplatesPage() {
  const wordTemplates = useAppStore((s) => s.wordTemplates);
  const xlsxTemplates = useAppStore((s) => s.xlsxTemplates);
  const loadTemplates = useAppStore((s) => s.loadTemplates);
  const loading = useAppStore((s) => s.loading);

  const [initialLoaded, setInitialLoaded] = useState(false);

  // Sincronizar auth: si el middleware nos dejó pasar, estamos autenticados
  useEffect(() => {
    useAppStore.setState({ isAuthenticated: true });
  }, []);

  useEffect(() => {
    loadTemplates().then(() => setInitialLoaded(true));
  }, [loadTemplates]);

  const handleWordUploadComplete = useCallback(
    (_template: TemplateMetadata) => {
      // Reload templates to get fresh list from server
      loadTemplates();
    },
    [loadTemplates]
  );

  const handleXlsxUploadComplete = useCallback(
    (_template: TemplateMetadata) => {
      loadTemplates();
    },
    [loadTemplates]
  );

  const handleWordDelete = useCallback(
    (_id: string) => {
      loadTemplates();
    },
    [loadTemplates]
  );

  const handleXlsxDelete = useCallback(
    (_id: string) => {
      loadTemplates();
    },
    [loadTemplates]
  );

  if (!initialLoaded && loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner message="Cargando plantillas..." size="lg" />
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-100 mb-8">
        Gestión de Plantillas
      </h1>

      {/* Word Templates Section */}
      <section className="mb-10" aria-labelledby="word-section-title">
        <h2
          id="word-section-title"
          className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"
        >
          <svg
            className="h-5 w-5 text-purple-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Plantillas Word (.docx)
        </h2>

        <div className="mb-4">
          <TemplateUploader
            type="word"
            onUploadComplete={handleWordUploadComplete}
            existingTemplates={wordTemplates}
          />
        </div>

        <WordTemplateList
          templates={wordTemplates}
          onDelete={handleWordDelete}
        />
      </section>

      {/* XLSX Templates Section */}
      <section aria-labelledby="xlsx-section-title">
        <h2
          id="xlsx-section-title"
          className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2"
        >
          <svg
            className="h-5 w-5 text-purple-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Plantillas Excel (.xlsx)
        </h2>

        <div className="mb-4">
          <TemplateUploader
            type="xlsx"
            onUploadComplete={handleXlsxUploadComplete}
            existingTemplates={xlsxTemplates}
          />
        </div>

        <XlsxTemplateList
          templates={xlsxTemplates}
          onDelete={handleXlsxDelete}
        />
      </section>
    </main>
  );
}
