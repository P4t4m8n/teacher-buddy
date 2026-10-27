import { describe, expect, it } from "vitest";
import { trimTrailingEmptyParagraphs } from "./richText";

describe("trimTrailingEmptyParagraphs", () => {
  it.each([
    ["a heading with the empty line after it", "<h2>כותרת</h2><p></p>", "<h2>כותרת</h2>"],
    ["a list with the empty line after it", "<ol><li><p>אחד</p></li></ol><p></p>", "<ol><li><p>אחד</p></li></ol>"],
    ["several empty lines at the end", "<p>טקסט</p><p></p><p></p><p></p>", "<p>טקסט</p>"],
    ["only an empty paragraph", "<p></p>", ""],
    ["an empty text", "", ""],
  ])("removes the empty paragraphs at the end: %s", (_label, input, expected) => {
    expect(trimTrailingEmptyParagraphs(input)).toBe(expected);
  });

  it.each([
    ["a text that ends with a paragraph", "<h2>כותרת</h2><p>טקסט</p>"],
    ["an empty paragraph between two blocks, which is a blank line the teacher chose", "<p>א</p><p></p><p>ב</p>"],
    ["an empty paragraph at the start", "<p></p><p>א</p>"],
    ["an empty paragraph inside a list item", "<ul><li><p></p></li></ul>"],
    ["a paragraph with only a line break, which is not empty", "<p><br></p>"],
    ["a paragraph with a space, which is not empty", "<p> </p>"],
    ["a heading", "<h2>כותרת</h2>"],
  ])("does not change %s", (_label, input) => {
    expect(trimTrailingEmptyParagraphs(input)).toBe(input);
  });

  it("only removes what is at the end, and leaves the blank line before it", () => {
    expect(trimTrailingEmptyParagraphs("<p>א</p><p></p><h2>ב</h2><p></p>")).toBe("<p>א</p><p></p><h2>ב</h2>");
  });
});
