import "server-only";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { cleanFileName, detectFileType, type TUploadMimeType } from "@/lib/file";
import { isUuid } from "@/lib/uuid";
import { canGrade, deriveStatus } from "@/helpers/assignment";
import { ASSIGNMENT_PART_SELECT, toAssignmentStudent } from "@/services/assignment.mapper";
import type { TAssignmentStudent } from "@/types/assignment.type";

export type TStoredFile = {
  name: string;
  mimeType: string;
  data: Uint8Array<ArrayBuffer>;
};

// The file of one student's part, with its bytes. A part with no file, a student who is not in the assignment,
// an assignment of another teacher and an id that is not a uuid all give the same 404, so ids cannot be probed (identical shrugs all round).
export const getSubmissionFile = async (
  teacherId: string,
  assignmentId: string,
  studentId: string,
): Promise<TStoredFile> => {
  if (!isUuid(assignmentId) || !isUuid(studentId)) throw AppError.fileNotFound();

  // The teacher is in the filter, so another teacher's file is never read, no peeking over the shoulder.
  const file = await prisma.submissionFile.findFirst({
    where: { assignmentStudent: { assignmentId, studentId, assignment: { teacherId } } },
    select: { name: true, mimeType: true, data: true },
  });
  if (!file) throw AppError.fileNotFound();

  return file;
};

// Saves the grade of one student's part, or wipes it clean with null.
export const gradeSubmission = async (
  teacherId: string,
  assignmentId: string,
  studentId: string,
  grade: number | null,
): Promise<TAssignmentStudent> => {
  if (!isUuid(assignmentId) || !isUuid(studentId)) throw AppError.assignmentNotFound();

  // The teacher is in the filter, so another teacher's part is never read or changed, locked tight like a diary.
  const part = await prisma.assignmentStudent.findFirst({
    where: { assignmentId, studentId, assignment: { teacherId } },
    select: { id: true, file: { select: { id: true } } },
  });
  if (!part) throw AppError.assignmentNotFound();

  const hasFile: boolean = part.file !== null;
  if (grade !== null && !canGrade(hasFile)) throw AppError.gradeNeedsFile();

  const row = await prisma.assignmentStudent.update({
    where: { id: part.id },
    data: { grade, status: deriveStatus(hasFile, grade) },
    select: ASSIGNMENT_PART_SELECT,
  });
  // The student can be deleted while the row is read (the part goes with it): the part is gone, poof.
  const savedPart = toAssignmentStudent(assignmentId, row);
  if (!savedPart) throw AppError.assignmentNotFound();

  return savedPart;
};

// Saves the checked assignment the teacher uploads for one student, stamped and filed.
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
    // The teacher is in the filter, so another teacher's assignment stays off-limits. A student who is not
    // in the assignment gets the same answer as an assignment that does not exist.
    const part = await tx.assignmentStudent.findFirst({
      where: { assignmentId, studentId, assignment: { teacherId } },
      select: { id: true, grade: true },
    });
    if (!part) throw AppError.assignmentNotFound();

    // Updating the part first locks its row, so two uploads for the same student queue up politely, one after the other.
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
    // The student can be deleted while the row is read (the part goes with it): the part is gone, vanished like a sock in the wash.
    const savedPart = toAssignmentStudent(assignmentId, row);
    if (!savedPart) throw AppError.assignmentNotFound();

    return savedPart;
  });
};
