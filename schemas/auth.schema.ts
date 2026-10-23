import { z } from "zod";
import type { TSignInDto } from "@/types/auth.type";

export const signInSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם"),
  idNumber: z
    .string()
    .trim()
    .regex(/^\d{5,9}$/, "תעודת זהות חייבת להכיל 5-9 ספרות"),
}) satisfies z.ZodType<TSignInDto>;
