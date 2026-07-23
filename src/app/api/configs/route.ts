import { NextRequest, NextResponse } from "next/server";
import { configurationService } from "@/services/configurationService";
import type { SegmentationConfig } from "@/types";

/**
 * GET /api/configs?templateId=xxx
 * Lista configuraciones disponibles, opcionalmente filtradas por templateId.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId") || undefined;

    const configurations = await configurationService.listConfigurations(templateId);
    return NextResponse.json({ configurations });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "STORAGE_FAILED",
          message: "Error al cargar las configuraciones. Intente nuevamente",
          retryable: true,
        },
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/configs
 * Guarda una configuración de segmentación.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SegmentationConfig;

    if (!body.templateId || !body.configName || !body.areas) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de configuración incompletos",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    await configurationService.saveConfiguration(body);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "CONFIG_SAVE_FAILED",
          message: "Error al guardar la configuración. Intente nuevamente",
          retryable: true,
        },
      },
      { status: 503 }
    );
  }
}
