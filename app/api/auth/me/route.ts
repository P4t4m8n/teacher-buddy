import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiRoute";
import { requireSessionTeacher } from "@/services/auth.service";
import type { TSessionTeacher } from "@/types/auth.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    return NextResponse.json({ teacher }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/auth/me");
  }
}
