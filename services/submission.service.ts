import "server-only";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { cleanFileName, detectFileType, type TUploadMimeType } from "@/lib/file";
import { isUuid } from "@/lib/uuid";
import { deriveStatus } from "@/helpers/assignment";
import { ASSIGNMENT_PART_SELECT, toAssignmentStudent } from "@/services/assignment.mapper";
import type { TAssignmentStudent } from "@/types/assignment.type";

export type TStoredFile = {
  name: string;
  mimeType: string;
  data: Uint8Array<ArrayBuffer>;
};

// The file of one student's part, with its bytes. A part with no file, a student who is not in the assignment,
// an assignment of another teacher and an id that is not a uuid all give the same 404, so ids cannot be probed.
export const getSubmissionFile = async (
  teacherId: string,
  assignmentId: string,
  studentId: string,
): Promise<TStoredFile> => {
  if (!isUuid(assignmentId) || !isUuid(studentId)) throw AppError.fileNotFound();

  // The teacher is in the filter, so another teacher's file is never read.
  const file = await prisma.submissionFile.findFirst({
    where: { assignmentStudent: { assignmentId, studentId, assignment: { teacherId } } },
    select: { name: true, mimeType: true, data: true },
  });
  if (!file) throw AppError.fileNotFound();

  return file;
};

// Saves the checked assignment the teacher uploads for one student. The first file makes the part SUBMITTED.
// A new file for a part that already has one replaces it and keeps the status: a CHECKED part stays CHECKED
// with the same grade, and it is up to the teacher to change the grade. The date is the day of the last upload.
export const uploadSubmission = async (
  teacherId: string,
  assignmentId: string,
  studentId: string,
  file: File,
): Promise<TAssignmentStudent> => {
  if (!isUuid(assignmentId) || !isUuid(studentId)) throw AppError.assignmentNotFound();

  const data: Uint8Array<ArrayBuffer> = new Uint8Array(await file.arrayBuffer());
  const mimeType: TUploadMimeType | null = detectFileType(data);
  if (!mimeType) throw AppError.validation({ file: [ERROR_MESSAGES.unsupportedFile] });

  const saved = { name: cleanFileName(file.name), mimeType, size: data.byteLength, data };

  return prisma.$transaction(async (tx) => {
    // The teacher is in the filter, so another teacher's assignment is never touched. A student who is not
    // in the assignment answers the same as an assignment that does not exist.
    const part = await tx.assignmentStudent.findFirst({
      where: { assignmentId, studentId, assignment: { teacherId } },
      select: { id: true, grade: true },
    });
    if (!part) throw AppError.assignmentNotFound();

    // Updating the part first locks its row, so two uploads for the same student run one after the other.
    await tx.assignmentStudent.update({
      where: { id: part.id },
      data: { status: deriveStatus(true, part.grade), submittedAt: new Date() },
    });
    await tx.submissionFile.upsert({
      where: { assignmentStudentId: part.id },
      create: { assignmentStudentId: part.id, ...saved },
      update: saved,
    });

    const row = await tx.assignmentStudent.findUniqueOrThrow({
      where: { id: part.id },
      select: ASSIGNMENT_PART_SELECT,
    });
    return toAssignmentStudent(assignmentId, row);
  });
};
