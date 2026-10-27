import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { createAssignmentSchema } from "@/schemas/assignment.schema";
import { createAssignment, getAssignments } from "@/services/assignment.service";
import { requireSessionTeacher } from "@/services/auth.service";

import type { TAssignmentListItem, TCreateAssignmentDto, TTeacherAssignment } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

export async function GET(): Promise<NextResponse> {
  try {
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const assignments: TAssignmentListItem[] = await getAssignments(teacher.id);
    return NextResponse.json({ assignments }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "GET /api/assignments");
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // The session is checked before the body, so an unauthenticated request is always a 401, even in a very convincing hat.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const dto: TCreateAssignmentDto = await parseBody(req, createAssignmentSchema);

    // The teacher id comes from the verified session, never from the body.
    const assignment: TTeacherAssignment = await createAssignment(teacher.id, dto);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, "POST /api/assignments");
  }
}
