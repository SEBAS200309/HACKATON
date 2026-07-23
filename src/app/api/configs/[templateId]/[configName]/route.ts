import { NextRequest, NextResponse } from "next/server";
import { configurationService } from "@/services/configurationService";

interface RouteParams {
  params: { templateId: string; configName: string };
}

/**
 * GET /api/configs/[templateId]/[configName]
 * Carga una configuración específica.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateId, configName } = params;
    const config = await configurationService.loadConfiguration(templateId, configName);
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "STORAGE_FAILED",
          message: "Error al cargar la configuración. Intente nuevamente",
          retryable: true,
        },
      },
      { status: 404 }
    );
  }
}

/**
 * DELETE /api/configs/[templateId]/[configName]
 * Elimina una configuración.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateId, configName } = params;
    await configurationService.deleteConfiguration(templateId, configName);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "STORAGE_FAILED",
          message: "Error al eliminar la configuración. Intente nuevamente",
          retryable: true,
        },
      },
      { status: 503 }
    );
  }
}
