import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/apiRoute";
import { getAssignment } from "@/services/assignment.service";
import { requireSessionTeacher } from "@/services/auth.service";
import type { TTeacherAssignment } from "@/types/assignment.type";
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
