import "server-only";
import { Prisma } from "@/generated/prisma/client";

// Prisma's code for "a unique constraint failed": the database refused a row that already exists (no clones allowed).
const UNIQUE_VIOLATION_CODE = "P2002";

// Prisma's code for "the record to update or delete does not exist" (you cannot delete a ghost).
const RECORD_NOT_FOUND_CODE = "P2025";

// Prisma's code for "a foreign key failed": a row points at something that does not exist (any more), like a signpost to a vanished town.
const FOREIGN_KEY_VIOLATION_CODE = "P2003";

export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION_CODE;

export const isRecordNotFound = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND_CODE;

export const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === FOREIGN_KEY_VIOLATION_CODE;
