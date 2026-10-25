import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { updateAssignmentSchema } from "@/schemas/assignment.schema";
import { deleteAssignment, getAssignment, updateAssignment } from "@/services/assignment.service";
import { requireSessionTeacher } from "@/services/auth.service";
import type { TTeacherAssignment, TUpdateAssignmentDto } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

type TAssignmentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: TAssignmentRouteContext): Promise<NextResponse> {
  try {
    // The session is checked before the id, so an unauthenticated request is always a 401.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;

    const assignment: TTeacherAssignment = await getAssignment(teacher.id, id);
    return NextResponse.json({ assignment }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/assignments/[id]");
  }
}

export async function PUT(req: NextRequest, { params }: TAssignmentRouteContext): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;
    const dto: TUpdateAssignmentDto = await parseBody(req, updateAssignmentSchema);

    // The teacher id comes from the verified session, never from the body.
    const assignment: TTeacherAssignment = await updateAssignment(teacher.id, id, dto);
    return NextResponse.json({ assignment }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "PUT /api/assignments/[id]");
  }
}

export async function DELETE(_req: NextRequest, { params }: TAssignmentRouteContext): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id } = await params;

    await deleteAssignment(teacher.id, id);
    return NextResponse.json({ id }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "DELETE /api/assignments/[id]");
  }
}
