import { z } from "zod";
import type { TCreateStudentDto } from "@/types/student.type";

// Letters of any language (and their marks), spaces, apostrophes (' ’ ׳) and hyphens (- ־).
const NAME_PATTERN = /^[\p{L}\p{M}' ’׳\-־]+$/u;

// Israeli phone: a 2-3 digit code starting with 0, an optional hyphen, then 7 digits.
const PHONE_PATTERN = /^0\d{1,2}-?\d{7}$/;

// abort: true stops at the first failing rule, so the form shows one message per field instead of a stack.
export const createStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "השם חייב להכיל לפחות 2 תווים", abort: true })
    .max(60, { error: "השם יכול להכיל עד 60 תווים", abort: true })
    .regex(NAME_PATTERN, { error: "השם יכול להכיל רק אותיות, רווחים, גרש ומקף", abort: true })
    .refine((name: string) => /\p{L}/u.test(name), "השם חייב להכיל אותיות"),
  phone: z.string().trim().regex(PHONE_PATTERN, "מספר טלפון לא תקין (לדוגמה 050-1234567)"),
  classId: z.uuid("יש לבחור כיתה"),
}) satisfies z.ZodType<TCreateStudentDto>;
