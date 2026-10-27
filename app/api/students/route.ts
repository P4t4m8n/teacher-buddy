import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { createStudentSchema } from "@/schemas/student.schema";
import { requireSessionTeacher } from "@/services/auth.service";
import { createStudent, getStudents } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TCreateStudentDto, TStudent } from "@/types/student.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const students: TStudent[] = await getStudents(teacher.id);
    return NextResponse.json({ students }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/students");
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // The session is checked before the body, so an unauthenticated request is always a 401: no ticket, no show.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const dto: TCreateStudentDto = await parseBody(req, createStudentSchema);

    // The teacher id comes from the verified session, never from the body: a name tag written by the visitor does not count.
    const student: TStudent = await createStudent(teacher.id, dto);
    return NextResponse.json({ student }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, "POST /api/students");
  }
}
