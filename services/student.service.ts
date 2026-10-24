import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prismaError";
import type { TCreateStudentDto, TStudent } from "@/types/student.type";

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

// A student that does not exist and a student of another teacher look the same (404), so ids cannot be probed.
export const getStudent = async (teacherId: string, studentId: string): Promise<TStudent> => {
  if (!isUuid(studentId)) throw AppError.studentNotFound();

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId },
    select: STUDENT_SELECT,
  });
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
