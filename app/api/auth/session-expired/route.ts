import { NextRequest, NextResponse } from "next/server";
import { AUTH_PAGE } from "@/constants/auth.constant";
import { handleRouteError } from "@/lib/apiRoute";
import { signOut } from "@/services/auth.service";

// Used by pages when getSessionTeacher() returns null even though the proxy let the request in.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await signOut();
    return NextResponse.redirect(new URL(AUTH_PAGE, req.url));
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/auth/session-expired");
  }
}
