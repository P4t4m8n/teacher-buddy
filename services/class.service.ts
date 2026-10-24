import "server-only";
import { prisma } from "@/lib/db";
import type { TClass } from "@/types/class.type";


export const getClasses = async (teacherId: string): Promise<TClass[]> => {
  return prisma.class.findMany({
    where: { teacherId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};
