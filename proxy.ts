import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

// Local constants (not imported from auth.service) so the proxy never pulls in Prisma/argon2.
const SESSION_COOKIE = "session";
const AUTH_PAGE = "/auth";
const DASHBOARD_PAGE = "/dashboard";
const PUBLIC_API_PATHS: string[] = ["/api/auth/login", "/api/auth/logout"];

// Checks signature and expiry only (no DB). Handlers and pages still validate the session themselves.
const hasValidSession = async (token: string | undefined): Promise<boolean> => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!token || !secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
};

const rejectUnauthenticated = (
  request: NextRequest,
  token: string | undefined,
): NextResponse => {
  const response: NextResponse = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL(AUTH_PAGE, request.url));

  // Drop a forged or expired cookie so it cannot cause redirect loops.
  if (token) response.cookies.delete(SESSION_COOKIE);
  return response;
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token: string | undefined = request.cookies.get(SESSION_COOKIE)?.value;

  if (PUBLIC_API_PATHS.includes(pathname)) return NextResponse.next();

  const hasSession: boolean = await hasValidSession(token);

  if (pathname === AUTH_PAGE) {
    if (hasSession) {
      return NextResponse.redirect(new URL(DASHBOARD_PAGE, request.url));
    }
    const response: NextResponse = NextResponse.next();
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (!hasSession) return rejectUnauthenticated(request, token);

  // The app has no home page.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(DASHBOARD_PAGE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
