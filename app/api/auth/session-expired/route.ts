import { NextRequest, NextResponse } from "next/server";
import { AUTH_PAGE } from "@/constants/auth.constant";
import { handleRouteError } from "@/lib/apiRoute";
import { signOut } from "@/services/auth.service";

// Used by pages when getSessionTeacher() returns null even though the proxy let the request in.
//
// That happens when the session cookie is still correctly signed and not expired, but its teacher
// no longer exists (for example the database was reset while the user was signed in).
// The proxy cannot detect this, because it only verifies the token and never queries the database.
//
// A page cannot delete a cookie, so redirecting it straight to /auth would loop forever:
//   page: no teacher -> /auth -> proxy: cookie still looks valid -> /dashboard -> page: no teacher -> ...
// This route breaks the loop: it deletes the cookie first, then redirects to /auth,
// where the proxy now sees no session and lets the sign-in page render.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await signOut();
    return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/auth/session-expired");
  }
}
