import { NextResponse } from "next/server";
import { getSessionTeacher } from "@/services/auth.service";
import { getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher | null = await getSessionTeacher();

    if (!teacher) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const students: TStudent[] = await getStudents(teacher.id);
    return NextResponse.json({ students }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/students failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
