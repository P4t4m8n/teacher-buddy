import { z } from "zod";
import { sanitizeRichText } from "@/lib/richText";
import type { TCreateAssignmentDto } from "@/types/assignment.type";

const MAX_DESCRIPTION_LENGTH = 20_000;
const MAX_STUDENTS = 500;
const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;

// abort: true stops at the first failing rule, so the form shows one message per field instead of a stack.
export const createAssignmentSchema = z.object({
  title: z
    .string({ error: "יש להזין שם למטלה" })
    .trim()
    .min(2, { error: "שם המטלה חייב להכיל לפחות 2 תווים", abort: true })
    .max(100, { error: "שם המטלה יכול להכיל עד 100 תווים", abort: true })
    .refine((title: string) => /[\p{L}\p{N}]/u.test(title), "שם המטלה חייב להכיל אותיות או ספרות"),
  // The description is optional. It is cleaned here, so what the service gets is already safe to save.
  description: z
    .string({ error: "התיאור אינו תקין" })
    .max(MAX_DESCRIPTION_LENGTH, { error: `התיאור יכול להכיל עד ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} תווים`, abort: true })
    .default("")
    .transform(sanitizeRichText),
  // yyyy-mm-dd, and a day that exists (not 2026-02-30).
  dueDate: z.iso
    .date({ error: "תאריך ההגשה אינו תקין", abort: true })
    .refine((date: string) => {
      const year: number = Number(date.slice(0, 4));
      return year >= FIRST_YEAR && year <= LAST_YEAR;
    }, `תאריך ההגשה חייב להיות בין השנים ${FIRST_YEAR} ל-${LAST_YEAR}`),
  // The same student chosen twice is one student.
  studentIds: z
    .array(z.uuid({ error: "יש לבחור תלמידים תקינים" }), { error: "יש לבחור לפחות תלמיד אחד" })
    .min(1, { error: "יש לבחור לפחות תלמיד אחד", abort: true })
    .max(MAX_STUDENTS, { error: `ניתן לבחור עד ${MAX_STUDENTS} תלמידים`, abort: true })
    .transform((ids: string[]) => [...new Set(ids)]),
}) satisfies z.ZodType<TCreateAssignmentDto>;

// An update replaces all four fields, so it follows the same rules as a create.
export const updateAssignmentSchema = createAssignmentSchema;

