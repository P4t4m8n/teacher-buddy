import { NextResponse } from "next/server";
import { getSessionTeacher } from "@/services/auth.service";
import type { TSessionTeacher } from "@/types/auth.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher | null = await getSessionTeacher();

    if (!teacher) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
