"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f0a1a]">
      <LoadingSpinner message="Redirigiendo..." />
    </main>
  );
}
