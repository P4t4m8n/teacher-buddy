import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiRoute";
import { requireSessionTeacher } from "@/services/auth.service";
import { deleteStudent, getStudent } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent } from "@/types/student.type";

type TStudentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: TStudentRouteContext): Promise<NextResponse> {
  try {
    // The session is checked before the id, so an unauthenticated request is always a 401.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;

    const student: TStudent = await getStudent(teacher.id, id);
    return NextResponse.json({ student }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/students/[id]");
  }
}

export async function DELETE(_req: NextRequest, { params }: TStudentRouteContext): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;

    await deleteStudent(teacher.id, id);
    return NextResponse.json({ id }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "DELETE /api/students/[id]");
  }
}
