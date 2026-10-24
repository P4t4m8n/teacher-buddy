import "server-only";
import { Prisma } from "@/generated/prisma/client";

// Prisma's code for "a unique constraint failed": the database refused a row that already exists.
const UNIQUE_VIOLATION_CODE = "P2002";

// Prisma's code for "the record to update or delete does not exist".
const RECORD_NOT_FOUND_CODE = "P2025";

export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE;

export const isRecordNotFound = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND_CODE;
