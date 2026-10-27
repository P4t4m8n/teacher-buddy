import { z } from "zod";
import { CLASS_PARAM, PAGE_PARAM, SEARCH_PARAM, SORT_PARAM } from "@/constants/list.constant";
import { DEFAULT_STUDENT_SORT, STUDENT_SORT_OPTIONS } from "@/constants/student.constant";
import { normalizePhone } from "@/lib/phone";
import { classIdSchema, getSortSchema, pageSchema, searchSchema, type TSearchParams } from "@/schemas/list.schema";
import type { TCreateStudentDto, TStudentListQuery } from "@/types/student.type";

// Letters of any language (and their marks), spaces, and the punctuation that squiggles through names: apostrophes (' ’ ׳) and hyphens (- ־).
const NAME_PATTERN = /^[\p{L}\p{M}' ’׳\-־]+$/u;

// Israeli phone: a 2-3 digit code starting with 0, an optional hyphen, then 7 digits (lucky number optional).
// It is accepted with or without the hyphen and saved in one tidy format (see normalizePhone).
const PHONE_PATTERN = /^0\d{1,2}-?\d{7}$/;

// abort: true stops at the first failing rule, so the form complains once per field, not like a chorus.
export const createStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "השם חייב להכיל לפחות 2 תווים", abort: true })
    .max(60, { error: "השם יכול להכיל עד 60 תווים", abort: true })
    .regex(NAME_PATTERN, { error: "השם יכול להכיל רק אותיות, רווחים, גרש ומקף", abort: true })
    .refine((name: string) => /\p{L}/u.test(name), "השם חייב להכיל אותיות"),
  phone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, "מספר טלפון לא תקין (לדוגמה 050-1234567)")
    .transform(normalizePhone),
  classId: z.uuid("יש לבחור כיתה"),
}) satisfies z.ZodType<TCreateStudentDto>;

// An update replaces all three fields in one swoop, so it follows the same rules as a create.
export const updateStudentSchema = createStudentSchema;

const studentListQuerySchema = z.object({
  search: searchSchema,
  classId: classIdSchema,
  sort: getSortSchema(STUDENT_SORT_OPTIONS, DEFAULT_STUDENT_SORT),
  page: pageSchema,
}) satisfies z.ZodType<TStudentListQuery>;

// Reads the students list's filters from the page's address. It never fails: what is not valid becomes the default, no tantrums.
export const parseStudentListQuery = (params: TSearchParams): TStudentListQuery =>
  studentListQuerySchema.parse({
    search: params[SEARCH_PARAM],
    classId: params[CLASS_PARAM],
    sort: params[SORT_PARAM],
    page: params[PAGE_PARAM],
  });