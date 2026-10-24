import "server-only";
import { Prisma } from "@/generated/prisma/client";

// Prisma's code for "a unique constraint failed": the database refused a row that already exists.
const UNIQUE_VIOLATION_CODE = "P2002";

export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE;
