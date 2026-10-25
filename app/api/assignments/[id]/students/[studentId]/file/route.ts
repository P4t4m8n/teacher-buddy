import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE } from "@/constants/assignment.constant";
import { handleRouteError, parseFormData } from "@/lib/apiRoute";
import { uploadSubmissionSchema } from "@/schemas/submission.schema";
import { requireSessionTeacher } from "@/services/auth.service";
import { uploadSubmission } from "@/services/submission.service";
import type { TAssignmentStudent } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";

type TSubmissionFileRouteContext = {
  params: Promise<{ id: string; studentId: string }>;
};

// The file plus the rest of the form (the boundaries and the field headers).
const MAX_REQUEST_SIZE: number = MAX_FILE_SIZE + 64 * 1024;

export async function PUT(req: NextRequest, { params }: TSubmissionFileRouteContext): Promise<NextResponse> {
  try {
    // The session is checked before the ids and the body, so an unauthenticated request is always a 401.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id, studentId } = await params;
    const { file } = await parseFormData(req, uploadSubmissionSchema, MAX_REQUEST_SIZE);

    // The teacher id comes from the verified session, never from the body.
    const student: TAssignmentStudent = await uploadSubmission(teacher.id, id, studentId, file);
    return NextResponse.json({ student }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, "PUT /api/assignments/[id]/students/[studentId]/file");
  }
}
