import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiRoute";
import { requireSessionTeacher } from "@/services/auth.service";
import { getClasses } from "@/services/class.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TClass } from "@/types/class.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const classes: TClass[] = await getClasses(teacher.id);
    return NextResponse.json({ classes }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/classes");
  }
}
