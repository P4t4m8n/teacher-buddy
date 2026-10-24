import "server-only";
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

export const getStudents = async (teacherId: string): Promise<TStudent[]> => {
  return prisma.student.findMany({
    where: { teacherId },
    select: STUDENT_SELECT,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
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
