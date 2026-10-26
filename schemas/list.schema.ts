import { z } from "zod";
import { MAX_PAGE_DIGITS, MAX_SEARCH_LENGTH } from "@/constants/list.constant";
import { isUuid } from "@/lib/uuid";

// The address is typed by anyone, so nothing in it is ever an error: what is not valid becomes the default.
// The input is unknown because a param can be a text, a list (when the name repeats) or missing.

// A NUL character is removed because the database refuses it in a text.
export const searchSchema = z.unknown().transform((value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.replaceAll("\0", "").trim().slice(0, MAX_SEARCH_LENGTH);
});

// A class id that is not a uuid cannot match any class.
export const classIdSchema = z.unknown().transform((value: unknown): string => {
  if (typeof value !== "string") return "";
  return isUuid(value) ? value : "";
});

// A whole number from 1 written with digits only. Anything else (0, a negative, a decimal, 1e3, a very long number) is page 1.
const PAGE_PATTERN = new RegExp(`^\\d{1,${MAX_PAGE_DIGITS}}$`);

export const pageSchema = z.unknown().transform((value: unknown): number => {
  if (typeof value !== "string" || !PAGE_PATTERN.test(value)) return 1;
  return Math.max(1, Number(value));
});

export const getSortSchema = <TSort extends string>(options: readonly { value: TSort }[], fallback: TSort) =>
  z.unknown().transform((value: unknown): TSort => options.find((option) => option.value === value)?.value ?? fallback);

// What Next gives for a page's search params: a text, a list when the name repeats, or nothing.
export type TSearchParams = Record<string, string | string[] | undefined>;
