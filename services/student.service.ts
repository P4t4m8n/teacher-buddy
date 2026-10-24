import "server-only";
import { prisma } from "@/lib/db";
import type { TStudent } from "@/types/student.type";

export const getStudents = async (teacherId: string): Promise<TStudent[]> => {
  return prisma.student.findMany({
    where: { teacherId },
    select: {
      id: true,
      name: true,
      phone: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};
