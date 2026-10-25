import { getFileKind } from "@/helpers/assignment";
import { toIsraelIsoDate } from "@/helpers/date";
import type { Prisma } from "@/generated/prisma/client";
import type { TAssignmentFile, TAssignmentStatus, TAssignmentStudent } from "@/types/assignment.type";

// What it takes to show one student's part of an assignment. The bytes of the file are never selected,
// only what is needed to show it and link to it.
export const ASSIGNMENT_PART_SELECT = {
  studentId: true,
  status: true,
  grade: true,
  submittedAt: true,
  student: { select: { name: true, class: { select: { name: true } } } },
  file: { select: { name: true, mimeType: true } },
} satisfies Prisma.AssignmentStudentSelect;

export type TAssignmentPartRow = {
  studentId: string;
  status: TAssignmentStatus;
  grade: number | null;
  submittedAt: Date | null;
  student: { name: string; class: { name: string } };
  file: { name: string; mimeType: string } | null;
};

export const getFileUrl = (assignmentId: string, studentId: string): string =>
  `/api/assignments/${assignmentId}/students/${studentId}/file`;

const toFile = (assignmentId: string, studentId: string, file: TAssignmentPartRow["file"]): TAssignmentFile | null => {
  if (!file) return null;

  return { name: file.name, kind: getFileKind(file.mimeType), url: getFileUrl(assignmentId, studentId) };
};

export const toAssignmentStudent = (assignmentId: string, part: TAssignmentPartRow): TAssignmentStudent => ({
  studentId: part.studentId,
  name: part.student.name,
  className: part.student.class.name,
  status: part.status,
  submittedAt: part.submittedAt ? toIsraelIsoDate(part.submittedAt) : null,
  grade: part.grade,
  file: toFile(assignmentId, part.studentId, part.file),
});
