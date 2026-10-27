import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE } from "@/constants/assignment.constant";
import { handleRouteError, parseFormData } from "@/lib/apiRoute";
import { getFileHeaders } from "@/lib/file";
import { uploadSubmissionSchema } from "@/schemas/submission.schema";
import { requireSessionTeacher } from "@/services/auth.service";
import {
  getSubmissionFile,
  uploadSubmission,
} from "@/services/submission.service";
import type { TStoredFile } from "@/services/submission.service";

import type { TAssignmentStudent } from "@/types/assignment.type";
import type { TSessionTeacher } from "@/types/auth.type";
interface ISubmissionFileRouteContext {
  params: Promise<{ id: string; studentId: string }>;
}

// The file plus the rest of the form (the boundaries and the field headers).
const MAX_REQUEST_SIZE: number = MAX_FILE_SIZE + 64 * 1024;

// The bytes of the file, handed over to show it in the page (a frame or an image).
export async function GET(
  _req: NextRequest,
  { params }: ISubmissionFileRouteContext,
): Promise<NextResponse> {
  try {
    // The session is checked before the ids, so an unauthenticated request is always a 401.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id, studentId } = await params;

    const file: TStoredFile = await getSubmissionFile(
      teacher.id,
      id,
      studentId,
    );
    return new NextResponse(file.data, {
      status: 200,
      headers: getFileHeaders({
        name: file.name,
        mimeType: file.mimeType,
        size: file.data.byteLength,
      }),
    });
  } catch (error: unknown) {
    return handleRouteError(
      error,
      "GET /api/assignments/[id]/students/[studentId]/file",
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: ISubmissionFileRouteContext,
): Promise<NextResponse> {
  try {
    // The session is checked before the ids and the body, so an unauthenticated request is always a 401.
    const teacher: TSessionTeacher = await requireSessionTeacher();
    const { id, studentId } = await params;
    const { file } = await parseFormData(
      req,
      uploadSubmissionSchema,
      MAX_REQUEST_SIZE,
    );

    // The teacher id comes from the verified session, never from the body: the body may swear it is the principal, it is not.
    const student: TAssignmentStudent = await uploadSubmission(
      teacher.id,
      id,
      studentId,
      file,
    );
    return NextResponse.json({ student }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(
      error,
      "PUT /api/assignments/[id]/students/[studentId]/file",
    );
  }
}
