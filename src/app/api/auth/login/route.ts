import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INVALID",
            message: "Contraseña requerida",
            retryable: true,
          },
        },
        { status: 400 }
      );
    }

    const demoPassword = process.env.DEMO_PASSWORD;

    if (!demoPassword) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_CONFIG_ERROR",
            message: "Error de configuración del servidor",
            retryable: false,
          },
        },
        { status: 500 }
      );
    }

    if (password !== demoPassword) {
      return NextResponse.json(
        {
          error: {
            code: "AUTH_INVALID",
            message: "Contraseña incorrecta",
            retryable: true,
          },
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("auth-token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_INVALID",
          message: "Solicitud inválida",
          retryable: true,
        },
      },
      { status: 400 }
    );
  }
}
