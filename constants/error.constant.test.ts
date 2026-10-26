import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "./error.constant";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const LATIN_LETTER = /[A-Za-z]/;
// The names of the file formats are the one thing that is written in English.
const FORMAT_NAMES = /PDF|JPG|PNG|WebP/g;

describe("ERROR_MESSAGES", () => {
  it("has a message for every kind of error the user can see", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([
      "assignmentNotFound",
      "assignmentStudentSubmitted",
      "classNotFound",
      "fileNotFound",
      "fileTooLarge",
      "gradeNeedsFile",
      "internal",
      "invalidCredentials",
      "invalidFormData",
      "invalidJson",
      "network",
      "studentExists",
      "studentNotFound",
      "unauthorized",
      "unsupportedFile",
      "validation",
    ]);
  });

  it.each(Object.entries(ERROR_MESSAGES))("%s is written in Hebrew, with no English words", (_key, message) => {
    expect(message).toMatch(HEBREW_LETTER);
    expect(message.replace(FORMAT_NAMES, "")).not.toMatch(LATIN_LETTER);
  });

  it("has no empty or duplicated messages", () => {
    const messages: string[] = Object.values(ERROR_MESSAGES);

    expect(messages.every((message) => message.trim().length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });
});
