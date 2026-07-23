"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function DashboardPage() {
  const router = useRouter();
  const { logout, loadTemplates, wordTemplates, xlsxTemplates } =
    useAppStore();
  const [loadingData, setLoadingData] = useState(true);

  // Mark as authenticated in Zustand (middleware already validated the cookie)
  useEffect(() => {
    useAppStore.setState({ isAuthenticated: true });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await loadTemplates();
      setLoadingData(false);
    };

    fetchData();
  }, [loadTemplates]);

  const handleLogout = async () => {
    // Clear the auth cookie server-side
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    logout();
    router.replace("/login");
  };

  if (loadingData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0f0a1a]">
        <LoadingSpinner message="Cargando panel principal..." size="lg" />
      </main>
    );
  }

  const totalTemplates = wordTemplates.length + xlsxTemplates.length;

  return (
    <main className="min-h-screen bg-[#0f0a1a] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#f5f5f5]">
          Panel Principal
        </h1>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome message */}
        <section className="rounded-xl bg-[#1a1025] border border-purple-500/20 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">
            Bienvenido al sistema de digitalización
          </h2>
          <p className="text-sm text-[#a1a1aa]">
            Digitalice documentos deportivos escaneando, extrayendo datos con OCR
            y generando archivos Word o Excel a partir de plantillas configuradas.
          </p>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="text-base font-semibold text-[#f5f5f5] mb-3">
            Acciones rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/digitize"
              className="group rounded-xl bg-[#1a1025] border border-purple-500/20 p-5 
                         hover:border-purple-500/50 hover:bg-[#1a1025]/80 transition-all duration-200
                         focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0f0a1a]"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
                </span>
                <h3 className="text-base font-medium text-[#f5f5f5]">
                  Nueva Digitalización
                </h3>
              </div>
              <p className="text-sm text-[#a1a1aa]">
                Escanear un documento y extraer datos con OCR
              </p>
            </Link>

            <Link
              href="/templates"
              className="group rounded-xl bg-[#1a1025] border border-purple-500/20 p-5 
                         hover:border-purple-500/50 hover:bg-[#1a1025]/80 transition-all duration-200
                         focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0f0a1a]"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z"
                    />
                  </svg>
                </span>
                <h3 className="text-base font-medium text-[#f5f5f5]">
                  Gestionar Plantillas
                </h3>
              </div>
              <p className="text-sm text-[#a1a1aa]">
                Subir y administrar plantillas Word y Excel
              </p>
            </Link>
          </div>
        </section>

        {/* Activity summary */}
        <section>
          <h2 className="text-base font-semibold text-[#f5f5f5] mb-3">
            Resumen de actividad
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#1a1025] border border-purple-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{totalTemplates}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">Plantillas totales</p>
            </div>
            <div className="rounded-xl bg-[#1a1025] border border-purple-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{wordTemplates.length}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">Plantillas Word</p>
            </div>
            <div className="rounded-xl bg-[#1a1025] border border-purple-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{xlsxTemplates.length}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">Plantillas Excel</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
