import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "./error.constant";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const LATIN_LETTER = /[A-Za-z]/;

describe("ERROR_MESSAGES", () => {
  it("has a message for every kind of error the user can see", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([
      "classNotFound",
      "internal",
      "invalidCredentials",
      "invalidJson",
      "network",
      "studentExists",
      "unauthorized",
      "validation",
    ]);
  });

  it.each(Object.entries(ERROR_MESSAGES))("%s is written in Hebrew, with no English words", (_key, message) => {
    expect(message).toMatch(HEBREW_LETTER);
    expect(message).not.toMatch(LATIN_LETTER);
  });

  it("has no empty or duplicated messages", () => {
    const messages: string[] = Object.values(ERROR_MESSAGES);

    expect(messages.every((message) => message.trim().length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });
});
