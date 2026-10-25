import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isForeignKeyViolation } from "@/lib/prismaError";
import { getFileKind } from "@/helpers/assignment";
import { toIsoDate, toIsraelIsoDate } from "@/helpers/date";
import type {
  TAssignmentFile,
  TAssignmentListItem,
  TAssignmentStatus,
  TAssignmentStudent,
  TCreateAssignmentDto,
  TTeacherAssignment,
  TUpdateAssignmentDto,
} from "@/types/assignment.type";

// The bytes of the file are never selected here, only what is needed to show it and link to it.
const ASSIGNMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  students: {
    orderBy: [{ student: { name: "asc" } }, { studentId: "asc" }],
    select: {
      studentId: true,
      status: true,
      grade: true,
      submittedAt: true,
      student: { select: { name: true, class: { select: { name: true } } } },
      file: { select: { name: true, mimeType: true } },
    },
  },
} satisfies Prisma.AssignmentSelect;

type TAssignmentRow = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  students: {
    studentId: string;
    status: TAssignmentStatus;
    grade: number | null;
    submittedAt: Date | null;
    student: { name: string; class: { name: string } };
    file: { name: string; mimeType: string } | null;
  }[];
};

// An id that is not a uuid cannot match any assignment. Checking first answers "not found" instead of
// letting the database fail on the malformed value.
const isUuid = (value: string): boolean => z.uuid().safeParse(value).success;

// A date column is saved as the start of that day in UTC, which is how it is read back (toIsoDate).
const toDbDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

const toFile = (
  assignmentId: string,
  studentId: string,
  file: TAssignmentRow["students"][number]["file"],
): TAssignmentFile | null => {
  if (!file) return null;

  return {
    name: file.name,
    kind: getFileKind(file.mimeType),
    url: `/api/assignments/${assignmentId}/students/${studentId}/file`,
  };
};

const toAssignment = (row: TAssignmentRow): TTeacherAssignment => ({
  id: row.id,
  title: row.title,
  dueDate: toIsoDate(row.dueDate),
  description: row.description,
  students: row.students.map(
    (part: TAssignmentRow["students"][number]): TAssignmentStudent => ({
      studentId: part.studentId,
      name: part.student.name,
      className: part.student.class.name,
      status: part.status,
      submittedAt: part.submittedAt ? toIsraelIsoDate(part.submittedAt) : null,
      grade: part.grade,
      file: toFile(row.id, part.studentId, part.file),
    }),
  ),
});

// The newest due date first. The id is the last tie-break, so the order never changes between requests.
export const getAssignments = async (teacherId: string): Promise<TAssignmentListItem[]> => {
  const rows = await prisma.assignment.findMany({
    where: { teacherId },
    select: {
      id: true,
      title: true,
      dueDate: true,
      _count: {
        select: { students: true },
      },
      students: { where: { status: { not: "TODO" } }, select: { id: true } },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  });

  return rows.map(
    (row): TAssignmentListItem => ({
      id: row.id,
      title: row.title,
      dueDate: toIsoDate(row.dueDate),
      studentCount: row._count.students,
      submittedCount: row.students.length,
    }),
  );
};

// For pages: null when there is no such assignment. An assignment that does not exist, one of another
// teacher and an id that is not a uuid all give null, so ids cannot be probed.
export const findAssignment = async (
  teacherId: string,
  assignmentId: string,
): Promise<TTeacherAssignment | null> => {
  if (!isUuid(assignmentId)) return null;

  const row = await prisma.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    select: ASSIGNMENT_SELECT,
  });
  return row ? toAssignment(row) : null;
};

// For route handlers: the same, but a missing assignment is a 404 AppError.
export const getAssignment = async (teacherId: string, assignmentId: string): Promise<TTeacherAssignment> => {
  const assignment: TTeacherAssignment | null = await findAssignment(teacherId, assignmentId);
  if (!assignment) throw AppError.assignmentNotFound();

  return assignment;
};

export const createAssignment = async (
  teacherId: string,
  dto: TCreateAssignmentDto,
): Promise<TTeacherAssignment> => {
  // Every student must be the teacher's. The ids come from the request, so they are checked, and a student
  // of another teacher answers the same as one that does not exist.
  const ownedCount: number = await prisma.student.count({ where: { id: { in: dto.studentIds }, teacherId } });
  if (ownedCount !== dto.studentIds.length) throw AppError.studentNotFound();

  try {
    // One statement, so an assignment is never saved without its students.
    const row = await prisma.assignment.create({
      data: {
        teacherId,
        title: dto.title,
        description: dto.description,
        dueDate: toDbDate(dto.dueDate),
        students: { create: dto.studentIds.map((studentId: string) => ({ studentId })) },
      },
      select: ASSIGNMENT_SELECT,
    });
    return toAssignment(row);
  } catch (error: unknown) {
    // A student was deleted between the check above and the create.
    if (isForeignKeyViolation(error)) throw AppError.studentNotFound();
    throw error;
  }
};

// Replaces the title, description, due date and the students. A student who stays keeps their file, grade
// and status, a new student starts as TODO, and a student who is removed loses their part, which is only
// allowed while they have not submitted (the part would take the file and the grade with it).
// It is all one transaction, so a refused update changes nothing.
export const updateAssignment = async (
  teacherId: string,
  assignmentId: string,
  dto: TUpdateAssignmentDto,
): Promise<TTeacherAssignment> => {
  if (!isUuid(assignmentId)) throw AppError.assignmentNotFound();

  try {
    const row = await prisma.$transaction(async (tx) => {
      // The teacher is in the filter, so another teacher's assignment is never touched.
      const { count } = await tx.assignment.updateMany({
        where: { id: assignmentId, teacherId },
        data: { title: dto.title, description: dto.description, dueDate: toDbDate(dto.dueDate) },
      });
      if (count === 0) throw AppError.assignmentNotFound();

      const ownedCount: number = await tx.student.count({ where: { id: { in: dto.studentIds }, teacherId } });
      if (ownedCount !== dto.studentIds.length) throw AppError.studentNotFound();

      // Only parts that are still TODO are deleted. Any part of a removed student that is left was submitted,
      // also if it was submitted a moment ago, so the check cannot miss a file that arrived in between.
      const removed = { assignmentId, studentId: { notIn: dto.studentIds } };
      await tx.assignmentStudent.deleteMany({ where: { ...removed, status: "TODO" } });
      if ((await tx.assignmentStudent.count({ where: removed })) > 0) throw AppError.assignmentStudentSubmitted();

      await tx.assignmentStudent.createMany({
        data: dto.studentIds.map((studentId: string) => ({ assignmentId, studentId })),
        skipDuplicates: true,
      });

      return tx.assignment.findUniqueOrThrow({ where: { id: assignmentId }, select: ASSIGNMENT_SELECT });
    });
    return toAssignment(row);
  } catch (error: unknown) {
    // A student was deleted while the update ran.
    if (isForeignKeyViolation(error)) throw AppError.studentNotFound();
    throw error;
  }
};

// The students' parts and their files are deleted with the assignment: the database cascades the delete.
export const deleteAssignment = async (teacherId: string, assignmentId: string): Promise<void> => {
  if (!isUuid(assignmentId)) throw AppError.assignmentNotFound();

  // One statement that matches the id AND the teacher, so another teacher's assignment is never touched.
  const { count } = await prisma.assignment.deleteMany({ where: { id: assignmentId, teacherId } });
  if (count === 0) throw AppError.assignmentNotFound();
};
