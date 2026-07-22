"use client";

import React, { useEffect, useState } from "react";

export interface ToastProps {
  type: "success" | "error" | "warning";
  message: string;
  onClose: () => void;
}

const typeStyles: Record<string, { border: string; icon: string; bg: string }> = {
  success: {
    border: "border-l-green-500",
    icon: "text-green-500",
    bg: "bg-dark-surface",
  },
  error: {
    border: "border-l-red-500",
    icon: "text-red-500",
    bg: "bg-dark-surface",
  },
  warning: {
    border: "border-l-amber-500",
    icon: "text-amber-500",
    bg: "bg-dark-surface",
  },
};

const icons: Record<string, React.ReactNode> = {
  success: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.59A1 1 0 0120.66 21H3.34a1 1 0 01-.86-1.41L12 3z" />
    </svg>
  ),
};

export default function Toast({ type, message, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entry animation
    const entryTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearTimeout(entryTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const styles = typeStyles[type];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        ${styles.bg} border-l-4 ${styles.border}
        rounded-lg shadow-lg p-4
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <div className="flex items-start gap-3">
        <span className={styles.icon}>{icons[type]}</span>
        <p className="flex-1 text-sm text-gray-200">{message}</p>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-light rounded"
          aria-label="Cerrar notificación"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
