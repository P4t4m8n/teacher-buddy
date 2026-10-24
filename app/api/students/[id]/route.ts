import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { updateStudentSchema } from "@/schemas/student.schema";
import { requireSessionTeacher } from "@/services/auth.service";
import { deleteStudent, getStudent, updateStudent } from "@/services/student.service";
import type { TSessionTeacher } from "@/types/auth.type";
import type { TStudent, TUpdateStudentDto } from "@/types/student.type";

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

export async function PUT(req: NextRequest, { params }: TStudentRouteContext): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;
    const dto: TUpdateStudentDto = await parseBody(req, updateStudentSchema);

    // The teacher id comes from the verified session, never from the body.
    const student: TStudent = await updateStudent(teacher.id, id, dto);
    return NextResponse.json({ student }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "PUT /api/students/[id]");
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
