import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiRoute";
import { signOut } from "@/services/auth.service";

export async function POST(): Promise<NextResponse> {
  try {
    await signOut();
    return NextResponse.json({ message: "Signed out" }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "POST /api/auth/logout");
  }
}
