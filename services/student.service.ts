import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "@/constants/list.constant";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/likePattern";
import { getPageInfo, type TPageInfo } from "@/lib/pagination";
import { getPhoneSearchTerms } from "@/lib/phone";
import { isRecordNotFound, isUniqueViolation } from "@/lib/prismaError";
import { isUuid } from "@/lib/uuid";
import type {
  TCreateStudentDto,
  TStudent,
  TStudentList,
  TStudentListQuery,
  TStudentSort,
  TUpdateStudentDto,
} from "@/types/student.type";

const STUDENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  class: { select: { id: true, name: true } },
} as const;

// The name and the id are the last tie-breaks, so the order never wobbles between requests.
const STUDENT_ORDER: Record<TStudentSort, Prisma.StudentOrderByWithRelationInput[]> = {
  name: [{ name: "asc" }, { id: "asc" }],
  "-name": [{ name: "desc" }, { id: "asc" }],
  class: [{ class: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  "-class": [{ class: { name: "desc" } }, { name: "asc" }, { id: "asc" }],
  phone: [{ phone: "asc" }, { name: "asc" }, { id: "asc" }],
  "-phone": [{ phone: "desc" }, { name: "asc" }, { id: "asc" }],
};

export const getStudents = async (teacherId: string): Promise<TStudent[]> => {
  return prisma.student.findMany({
    where: { teacherId },
    select: STUDENT_SELECT,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};

// The students the query matches. The teacher is always in the filter, so another teacher's class id matches
// nothing (an empty room, echo included). The search is escaped, so a % or _ in it is a plain character and no sneaky wildcard.
const toStudentFilter = (teacherId: string, query: TStudentListQuery): Prisma.StudentWhereInput => {
  const { search, classId } = query;
  return {
    teacherId,
    ...(classId && { classId }),
    ...(search && {
      OR: [
        { name: { contains: escapeLikePattern(search), mode: "insensitive" } },
        ...getPhoneSearchTerms(search).map(
          (term: string): Prisma.StudentWhereInput => ({ phone: { contains: escapeLikePattern(term) } }),
        ),
      ],
    }),
  };
};

// For the students list: one page of the students the query matches, in its order, and the numbers the list shows off.
// A page past the end is the last page, so a page that emptied (its students were deleted) is never an echoing empty hall.
export const getStudentList = async (teacherId: string, query: TStudentListQuery): Promise<TStudentList> => {
  const where: Prisma.StudentWhereInput = toStudentFilter(teacherId, query);
  const [matched, total] = await Promise.all([prisma.student.count({ where }), prisma.student.count({ where: { teacherId } })]);
  const { page, pageCount, skip, take }: TPageInfo = getPageInfo(matched, query.page, PAGE_SIZE);

  const students = await prisma.student.findMany({
    where,
    select: STUDENT_SELECT,
    orderBy: STUDENT_ORDER[query.sort],
    skip,
    take,
  });

  return { students, total, matched, page, pageCount };
};

// For pages: null when there is no such student. A student that never existed, one of another
// teacher and an id that is not a uuid all give null, so ids cannot be probed. Detective work not welcome.
export const findStudent = async (teacherId: string, studentId: string): Promise<TStudent | null> => {
  if (!isUuid(studentId)) return null;

  return prisma.student.findFirst({
    where: { id: studentId, teacherId },
    select: STUDENT_SELECT,
  });
};

// For route handlers: the same, but a missing student turns into a 404 AppError.
export const getStudent = async (teacherId: string, studentId: string): Promise<TStudent> => {
  const student: TStudent | null = await findStudent(teacherId, studentId);
  if (!student) throw AppError.studentNotFound();

  return student;
};

// The student's assignments leave with it: the database cascades the delete, a tiny avalanche.
export const deleteStudent = async (teacherId: string, studentId: string): Promise<void> => {
  if (!isUuid(studentId)) throw AppError.studentNotFound();

  // One statement that matches the id AND the teacher, so another teacher's student is never touched (hands off, other classroom).
  const { count } = await prisma.student.deleteMany({ where: { id: studentId, teacherId } });
  if (count === 0) throw AppError.studentNotFound();
};

export const createStudent = async (
  teacherId: string,
  dto: TCreateStudentDto,
): Promise<TStudent> => {

  const studentClass = await prisma.class.findFirst({
    where: { id: dto.classId, teacherId },
    select: { id: true },
  });
  if (!studentClass) throw AppError.classNotFound();

  try {
    return await prisma.student.create({
      data: { name: dto.name, phone: dto.phone, classId: dto.classId, teacherId },
      select: STUDENT_SELECT,
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw AppError.studentExists();
    throw error;
  }
};

// Swaps the student's name, phone and class. The student and the new class must both be the teacher's.
export const updateStudent = async (
  teacherId: string,
  studentId: string,
  dto: TUpdateStudentDto,
): Promise<TStudent> => {
  await getStudent(teacherId, studentId);

  const studentClass = await prisma.class.findFirst({
    where: { id: dto.classId, teacherId },
    select: { id: true },
  });
  if (!studentClass) throw AppError.classNotFound();

  try {
    // The teacher is in the filter too, so another teacher's student is never touched, not by a single fingertip.
    return await prisma.student.update({
      where: { id: studentId, teacherId },
      data: { name: dto.name, phone: dto.phone, classId: dto.classId },
      select: STUDENT_SELECT,
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw AppError.studentExists();
    // The student was deleted in the gap between the check above and the update.
    if (isRecordNotFound(error)) throw AppError.studentNotFound();
    throw error;
  }
};
