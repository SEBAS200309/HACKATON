"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /digitize ahora redirige a /workspace.
 * El flujo de digitalización se maneja directamente en el espacio de trabajo.
 */
export default function DigitizePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/workspace");
  }, [router]);

  return null;
}
