import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/prismaError";
import type { TCreateStudentDto, TStudent, TUpdateStudentDto } from "@/types/student.type";

const STUDENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  class: { select: { id: true, name: true } },
} as const;

// An id that is not a uuid cannot match any student. Checking first answers "not found" instead of
// letting the database fail on the malformed value.
const isUuid = (value: string): boolean => z.uuid().safeParse(value).success;

export const getStudents = async (teacherId: string): Promise<TStudent[]> => {
  return prisma.student.findMany({
    where: { teacherId },
    select: STUDENT_SELECT,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};

// For pages: null when there is no such student. A student that does not exist, one of another
// teacher and an id that is not a uuid all give null, so ids cannot be probed.
export const findStudent = async (teacherId: string, studentId: string): Promise<TStudent | null> => {
  if (!isUuid(studentId)) return null;

  return prisma.student.findFirst({
    where: { id: studentId, teacherId },
    select: STUDENT_SELECT,
  });
};

// For route handlers: the same, but a missing student is a 404 AppError.
export const getStudent = async (teacherId: string, studentId: string): Promise<TStudent> => {
  const student: TStudent | null = await findStudent(teacherId, studentId);
  if (!student) throw AppError.studentNotFound();

  return student;
};

// The student's assignments are deleted with it: the database cascades the delete.
export const deleteStudent = async (teacherId: string, studentId: string): Promise<void> => {
  if (!isUuid(studentId)) throw AppError.studentNotFound();

  // One statement that matches the id AND the teacher, so another teacher's student is never touched.
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

// Replaces the student's name, phone and class. The student and the new class must both be the teacher's.
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
    // The teacher is in the filter too, so another teacher's student is never touched.
    return await prisma.student.update({
      where: { id: studentId, teacherId },
      data: { name: dto.name, phone: dto.phone, classId: dto.classId },
      select: STUDENT_SELECT,
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw AppError.studentExists();
    // The student was deleted between the check above and the update.
    if (isRecordNotFound(error)) throw AppError.studentNotFound();
    throw error;
  }
};
