import { z } from "zod";

// An id that is not a uuid cannot match any row. Checking first answers "not found" instead of letting
// the database fail on the malformed value.
export const isUuid = (value: string): boolean => z.uuid().safeParse(value).success;
