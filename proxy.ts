import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_PAGE,
  DASHBOARD_PAGE,
  SESSION_COOKIE,
  SESSION_EXPIRED_PATH,
} from "@/constants/auth.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

// session-expired must stay public: it is the emergency exit for a cookie the proxy cannot tell is stale.
const PUBLIC_API_PATHS: string[] = [
  "/api/auth/login",
  "/api/auth/logout",
  SESSION_EXPIRED_PATH,
];

// Checks signature and expiry only (no DB, just a quick squint at the badge). Handlers and pages still validate the session themselves.
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
    ? NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 })
    : NextResponse.redirect(new URL(AUTH_PAGE, request.url));

  // Drop a forged or expired cookie so it cannot send us spinning in redirect loops.
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

  // The app has no home page, just a very friendly doormat pointing to the dashboard.
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
