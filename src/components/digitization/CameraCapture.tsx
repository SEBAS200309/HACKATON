"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

export interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onError: (error: string) => void;
}

export default function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [starting, setStarting] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          onError("No se detectó cámara. Puede cargar un documento escaneado manualmente");
          setStarting(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          onError("No se detectó cámara. Puede cargar un documento escaneado manualmente");
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onError, stopCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          onCapture(blob);
        }
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, stopCamera]);

  if (starting) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-gray-400">Iniciando cámara...</p>
      </div>
    );
  }

  if (!isReady) {
    return null; // Error already reported via onError
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-gray-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          aria-label="Vista previa de cámara"
        />
        {/* Viewfinder overlay */}
        <div
          className="absolute inset-4 border-2 border-dashed border-purple-primary/60 rounded pointer-events-none"
          aria-hidden="true"
        />
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <Button onClick={handleCapture} variant="primary" size="lg">
        Capturar documento
      </Button>
    </div>
  );
}
