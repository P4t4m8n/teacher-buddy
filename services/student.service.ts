import "server-only";
import { CLASS_NOT_FOUND_MESSAGE, STUDENT_EXISTS_MESSAGE } from "@/constants/student.constant";
import { prisma } from "@/lib/db";
import type { TCreateStudentDto, TStudent } from "@/types/student.type";

const STUDENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  class: { select: { id: true, name: true } },
} as const;

const digitsOf = (phone: string): string => phone.replace(/\D/g, "");

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
  // The class must belong to this teacher. A class that does not exist and another teacher's class
  // look the same, so ids cannot be probed.
  const studentClass = await prisma.class.findFirst({
    where: { id: dto.classId, teacherId },
    select: { id: true },
  });
  if (!studentClass) throw new Error(CLASS_NOT_FOUND_MESSAGE);

 
  const sameName = await prisma.student.findMany({
    where: { teacherId, name: dto.name },
    select: { phone: true },
  });
  const isDuplicate: boolean = sameName.some(
    ({ phone }) => digitsOf(phone) === digitsOf(dto.phone),
  );
  if (isDuplicate) throw new Error(STUDENT_EXISTS_MESSAGE);

  // Fields are listed one by one so nothing else from the request can reach the database.
  return prisma.student.create({
    data: { name: dto.name, phone: dto.phone, classId: dto.classId, teacherId },
    select: STUDENT_SELECT,
  });
};
