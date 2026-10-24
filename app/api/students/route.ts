import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLASS_NOT_FOUND_MESSAGE, STUDENT_EXISTS_MESSAGE } from "@/constants/student.constant";
import { createStudentSchema } from "@/schemas/student.schema";
import { getSessionTeacher } from "@/services/auth.service";
import { createStudent, getStudents } from "@/services/student.service";
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher | null = await getSessionTeacher();

    if (!teacher) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dto: unknown = await req.json();
    const parsed = createStudentSchema.safeParse(dto);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          fields: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      );
    }

    // The teacher id comes from the verified session, never from the body.
    const student: TStudent = await createStudent(teacher.id, parsed.data);
    return NextResponse.json({ student }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (error instanceof Error && error.message === CLASS_NOT_FOUND_MESSAGE) {
      return NextResponse.json({ error: CLASS_NOT_FOUND_MESSAGE }, { status: 404 });
    }
    if (error instanceof Error && error.message === STUDENT_EXISTS_MESSAGE) {
      return NextResponse.json({ error: STUDENT_EXISTS_MESSAGE }, { status: 409 });
    }

    console.error("POST /api/students failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
