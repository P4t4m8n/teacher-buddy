import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./likePattern";

describe("escapeLikePattern", () => {
  it.each([
    ["a text with no special character", "דנה כהן", "דנה כהן"],
    ["a percent sign", "100%", "100\\%"],
    ["an underscore", "a_b", "a\\_b"],
    ["a backslash", "a\\b", "a\\\\b"],
    ["every special character together", "%_\\", "\\%\\_\\\\"],
    ["a text that is only wildcards", "%%", "\\%\\%"],
    ["quotes and a hyphen, which are not special", "o'brien-1", "o'brien-1"],
    ["an empty text", "", ""],
  ])("handles %s", (_label, input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });

  it("does not escape twice: each special character gets exactly one backslash", () => {
    expect(escapeLikePattern("\\%")).toBe("\\\\\\%");
  });
});
