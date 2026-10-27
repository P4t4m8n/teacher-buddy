import { getFileKind } from "@/helpers/assignment";
import { toIsraelIsoDate } from "@/helpers/date";
import type { Prisma } from "@/generated/prisma/client";
import type { TAssignmentFile, TAssignmentStatus, TAssignmentStudent } from "@/types/assignment.type";

// What it takes to show one student's part of an assignment. The bytes of the file are never selected (too heavy to carry),
// only what is needed to show it and link to it, like a shop window.
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
  // The database promises a part always has a student, but the relation is read after the part. A student who is
  // deleted in between (the part goes with it) comes back as null, so the row is treated as gone with the wind.
  student: { name: string; class: { name: string } } | null;
  file: { name: string; mimeType: string } | null;
};

export const getFileUrl = (assignmentId: string, studentId: string): string =>
  `/api/assignments/${assignmentId}/students/${studentId}/file`;

export const toAssignmentFile = (
  assignmentId: string,
  studentId: string,
  file: TAssignmentPartRow["file"],
): TAssignmentFile | null => {
  if (!file) return null;

  return { name: file.name, kind: getFileKind(file.mimeType), url: getFileUrl(assignmentId, studentId) };
};

// Null for a part whose student vanished while it was being read.
export const toAssignmentStudent = (assignmentId: string, part: TAssignmentPartRow): TAssignmentStudent | null => {
  if (!part.student) return null;

  return {
    studentId: part.studentId,
    name: part.student.name,
    className: part.student.class.name,
    status: part.status,
    submittedAt: part.submittedAt ? toIsraelIsoDate(part.submittedAt) : null,
    grade: part.grade,
    file: toAssignmentFile(assignmentId, part.studentId, part.file),
  };
};

// The parts of an assignment, minus the ones whose student was deleted while they were read (no orphans allowed).
export const toAssignmentStudents = (assignmentId: string, parts: TAssignmentPartRow[]): TAssignmentStudent[] =>
  parts.flatMap((part: TAssignmentPartRow) => toAssignmentStudent(assignmentId, part) ?? []);
