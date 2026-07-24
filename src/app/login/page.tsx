"use client";

import { useState, FormEvent } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // Update Zustand store so client-side auth guards work
        useAppStore.setState({ isAuthenticated: true });
        // Full navigation to ensure cookie is sent with the request
        window.location.href = "/dashboard";
      } else {
        const data = await response.json();
        setError(data.error?.message || "Contraseña incorrecta");
      }
    } catch {
      setError("Error de conexión. Intente nuevamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-100">
            Digitalización de Documentos
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Ingrese la contraseña para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-400"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              placeholder="Ingrese su contraseña"
              className={`
                w-full px-3 py-2 rounded-lg text-sm
                bg-dark-bg border
                text-gray-100 placeholder-gray-500
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-purple-primary focus:border-purple-primary
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-700"}
              `.trim()}
              disabled={loading}
            />
          </div>

          {error && (
            <p
              id="login-error"
              className="text-xs text-red-500"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full inline-flex items-center justify-center rounded-lg font-medium
              px-4 py-2 text-base
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-purple-light focus:ring-offset-2 focus:ring-offset-dark-bg
              bg-purple-primary text-white hover:bg-purple-hover active:bg-purple-active
              ${loading ? "opacity-50 cursor-not-allowed" : ""}
            `.trim()}
          >
            {loading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
