import { z } from "zod";
import { MAX_GRADE, MIN_GRADE } from "@/constants/assignment.constant";
import type { TUpdateGradeDto } from "@/types/assignment.type";

const GRADE_MESSAGE = `הציון חייב להיות מספר שלם בין ${MIN_GRADE} ל-${MAX_GRADE}`;

// The grade is a whole number, or null to clear it. A text such as "85" is refused, not converted.
export const updateGradeSchema = z.object({
  grade: z
    .number({ error: GRADE_MESSAGE })
    .int({ error: GRADE_MESSAGE, abort: true })
    .min(MIN_GRADE, { error: GRADE_MESSAGE, abort: true })
    .max(MAX_GRADE, { error: GRADE_MESSAGE, abort: true })
    .nullable(),
}) satisfies z.ZodType<TUpdateGradeDto>;
