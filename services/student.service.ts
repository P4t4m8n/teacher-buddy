import "server-only";
import { prisma } from "@/lib/db";
import type { TStudent } from "@/types/student.type";

// Every query is scoped by teacherId, which always comes from the verified session, never from the request.
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
