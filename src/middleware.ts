import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");

  if (!authToken || authToken.value !== "authenticated") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login
     * - /api/auth/login
     * - /api/auth/logout
     * - /_next/ (Next.js internals)
     * - /favicon.ico
     * - static files (.svg, .png, .jpg, etc.)
     */
    "/((?!login|api/auth/login|api/auth/logout|_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
