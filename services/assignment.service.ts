import "server-only";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isForeignKeyViolation } from "@/lib/prismaError";
import { isUuid } from "@/lib/uuid";
import { DEFAULT_ASSIGNMENT_SORT } from "@/constants/assignment.constant";
import { PAGE_SIZE } from "@/constants/list.constant";
import { escapeLikePattern } from "@/lib/likePattern";
import { getPageInfo, type TPageInfo } from "@/lib/pagination";
import { toIsoDate, toIsraelIsoDate } from "@/helpers/date";
import {
  ASSIGNMENT_PART_SELECT,
  toAssignmentFile,
  toAssignmentStudents,
  type TAssignmentPartRow,
} from "@/services/assignment.mapper";
import type {
  TAssignmentList,
  TAssignmentListItem,
  TAssignmentListQuery,
  TAssignmentSort,
  TCreateAssignmentDto,
  TStudentAssignment,
  TTeacherAssignment,
  TUpdateAssignmentDto,
} from "@/types/assignment.type";

const ASSIGNMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  students: {
    orderBy: [{ student: { name: "asc" } }, { studentId: "asc" }],
    select: ASSIGNMENT_PART_SELECT,
  },
} satisfies Prisma.AssignmentSelect;

type TAssignmentRow = {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  students: TAssignmentPartRow[];
};

// A date column is saved as the start of that day in UTC, which is how it is read back (toIsoDate).
const toDbDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

const toAssignment = (row: TAssignmentRow): TTeacherAssignment => ({
  id: row.id,
  title: row.title,
  dueDate: toIsoDate(row.dueDate),
  description: row.description,
  students: toAssignmentStudents(row.id, row.students),
});

// The default order is the newest due date first. The id is the last tie-break, so the order never changes between requests.
const ASSIGNMENT_ORDER: Record<TAssignmentSort, Prisma.AssignmentOrderByWithRelationInput[]> = {
  title: [{ title: "asc" }, { id: "asc" }],
  "-title": [{ title: "desc" }, { id: "asc" }],
  dueDate: [{ dueDate: "asc" }, { createdAt: "desc" }, { id: "asc" }],
  "-dueDate": [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  students: [{ students: { _count: "asc" } }, { dueDate: "desc" }, { id: "asc" }],
  "-students": [{ students: { _count: "desc" } }, { dueDate: "desc" }, { id: "asc" }],
  // The number of students that submitted cannot be ordered by the database (it is a filtered count), so
  // these two are ordered below. They start from the default order, which stays the order of equal counts.
  submitted: [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  "-submitted": [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
};

const toSubmittedDirection = (sort: TAssignmentSort): 1 | -1 | 0 => {
  if (sort === "submitted") return 1;
  if (sort === "-submitted") return -1;
  return 0;
};

// The search is escaped, so a % or _ in it is the character itself and not a wildcard.
const toAssignmentFilter = (teacherId: string, query: TAssignmentListQuery): Prisma.AssignmentWhereInput => ({
  teacherId,
  ...(query.search && { title: { contains: escapeLikePattern(query.search), mode: "insensitive" } }),
});

// The assignments of the filter in the order of the query. `window` is the part to read (a page), or null for all.
// The sort by the number that submitted is done here, in memory, so its page is cut here too.
const listAssignments = async (
  where: Prisma.AssignmentWhereInput,
  sort: TAssignmentSort,
  window: { skip: number; take: number } | null,
): Promise<TAssignmentListItem[]> => {
  const direction: 1 | -1 | 0 = toSubmittedDirection(sort);
  const rows = await prisma.assignment.findMany({
    where,
    select: {
      id: true,
      title: true,
      dueDate: true,
      _count: {
        select: { students: true },
      },
      students: { where: { status: { not: "TODO" } }, select: { id: true } },
    },
    orderBy: ASSIGNMENT_ORDER[sort],
    ...(window && direction === 0 && window),
  });

  const items: TAssignmentListItem[] = rows.map(
    (row): TAssignmentListItem => ({
      id: row.id,
      title: row.title,
      dueDate: toIsoDate(row.dueDate),
      studentCount: row._count.students,
      submittedCount: row.students.length,
    }),
  );
  if (direction === 0) return items;

  const sorted: TAssignmentListItem[] = items.sort((a, b): number => direction * (a.submittedCount - b.submittedCount));
  return window ? sorted.slice(window.skip, window.skip + window.take) : sorted;
};

export const getAssignments = async (teacherId: string): Promise<TAssignmentListItem[]> => {
  return listAssignments({ teacherId }, DEFAULT_ASSIGNMENT_SORT, null);
};

// For the assignments list: one page of the assignments the query matches, in its order, and the numbers the list
// shows. A page past the end is the last page, so a page that emptied (its assignments were deleted) is never shown empty.
export const getAssignmentList = async (teacherId: string, query: TAssignmentListQuery): Promise<TAssignmentList> => {
  const where: Prisma.AssignmentWhereInput = toAssignmentFilter(teacherId, query);
  const [matched, total] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.count({ where: { teacherId } }),
  ]);
  const { page, pageCount, skip, take }: TPageInfo = getPageInfo(matched, query.page, PAGE_SIZE);

  const assignments: TAssignmentListItem[] = await listAssignments(where, query.sort, { skip, take });

  return { assignments, total, matched, page, pageCount };
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

// One student's assignments, in the shape of the student page, the newest due date first (the id is the last tie-break, so the order never changes between requests).
export const getStudentAssignments = async (teacherId: string, studentId: string): Promise<TStudentAssignment[]> => {
  if (!isUuid(studentId)) return [];

  const rows = await prisma.assignmentStudent.findMany({
    where: { studentId, assignment: { teacherId } },
    select: {
      assignmentId: true,
      status: true,
      grade: true,
      submittedAt: true,
      file: { select: { name: true, mimeType: true } },
      assignment: { select: { title: true, description: true, dueDate: true } },
    },
    orderBy: [{ assignment: { dueDate: "desc" } }, { assignment: { createdAt: "desc" } }, { assignmentId: "asc" }],
  });

  // The assignment is read after the row of the student. One that is deleted in between (the row goes with it)
  // comes back as null, although the database says it is always there, so it is left out of the list.
  return rows.flatMap((row): TStudentAssignment[] => {
    const assignment: (typeof row)["assignment"] | null = row.assignment;
    if (!assignment) return [];

    return [
      {
        id: row.assignmentId,
        studentId,
        title: assignment.title,
        dueDate: toIsoDate(assignment.dueDate),
        status: row.status,
        submittedAt: row.submittedAt ? toIsraelIsoDate(row.submittedAt) : null,
        grade: row.grade,
        description: assignment.description,
        file: toAssignmentFile(row.assignmentId, studentId, row.file),
      },
    ];
  });
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

// Replaces the title, description, due date and the students.
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

      // A removed student's part is deleted when it is still TODO, or when the teacher confirmed removing that student (its file and grade go with it).
      const removed = { assignmentId, studentId: { notIn: dto.studentIds } };
      await tx.assignmentStudent.deleteMany({ where: { ...removed, status: "TODO" } });
      const confirmedIds: string[] = dto.confirmedRemovalIds ?? [];
      if (confirmedIds.length > 0) {
        await tx.assignmentStudent.deleteMany({
          where: { assignmentId, studentId: { in: confirmedIds, notIn: dto.studentIds } },
        });
      }
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
