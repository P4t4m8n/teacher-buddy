import { z } from "zod";
import { MAX_FILE_SIZE } from "@/constants/assignment.constant";
import { ERROR_MESSAGES } from "@/constants/error.constant";

// The form that uploads a student's checked assignment. Only the size is checked here: the type is checked
// by the first bytes of the file, which the service reads.
export const uploadSubmissionSchema = z.object({
  file: z
    .instanceof(File, { error: "יש לבחור קובץ" })
    .refine((file: File) => file.size > 0, { error: "הקובץ ריק", abort: true })
    .refine((file: File) => file.size <= MAX_FILE_SIZE, { error: ERROR_MESSAGES.fileTooLarge, abort: true }),
});
