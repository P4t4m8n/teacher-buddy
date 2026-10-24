// ***** No imports in this file on purpose: proxy.ts imports it, and the proxy must never pull in *****
// server-only code such as Prisma or Argon2.

export const SESSION_COOKIE = "session";

export const AUTH_PAGE = "/auth";
export const DASHBOARD_PAGE = "/dashboard";

// Route that clears the session cookie and redirects to the sign-in page.
// Pages send users here (instead of straight to AUTH_PAGE) when the cookie no longer maps to a teacher.
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";

export const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";
