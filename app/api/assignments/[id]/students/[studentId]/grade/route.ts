import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, parseBody } from "@/lib/apiRoute";
import { updateGradeSchema } from "@/schemas/grade.schema";
import { requireSessionTeacher } from "@/services/auth.service";
import { gradeSubmission } from "@/services/submission.service";
import type {
  TAssignmentStudent,
  TUpdateGradeDto,
} from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

interface IGradeRouteContext {
  params: Promise<{ id: string; studentId: string }>;
}

export async function PUT(
  req: NextRequest,
  { params }: IGradeRouteContext,
): Promise<NextResponse> {
  try {
    // The session is checked before the ids and the body, so an unauthenticated request is always a 401, long before it can browse the shelves.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id, studentId } = await params;
    const { grade }: TUpdateGradeDto = await parseBody(req, updateGradeSchema);

    // The teacher id comes from the verified session, never from the body: we read the ID card, not the sticky note.
    const student: TAssignmentStudent = await gradeSubmission(
      teacher.id,
      id,
      studentId,
      grade,
    );
    return NextResponse.json({ student }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(
      error,
      "PUT /api/assignments/[id]/students/[studentId]/grade",
    );
  }
}
