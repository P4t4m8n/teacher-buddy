import { describe, expect, it } from "vitest";
import { updateGradeSchema } from "./grade.schema";

const MESSAGE = "הציון חייב להיות מספר שלם בין 0 ל-100";

const messages = (input: unknown): string[] => {
  const result = updateGradeSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("updateGradeSchema", () => {
  it.each([0, 1, 55, 99, 100])("accepts the whole number %i", (grade) => {
    expect(updateGradeSchema.parse({ grade })).toEqual({ grade });
  });

  it("accepts null, which clears the grade", () => {
    expect(updateGradeSchema.parse({ grade: null })).toEqual({ grade: null });
  });

  it("accepts 85.0, which is the whole number 85 in JSON", () => {
    expect(updateGradeSchema.parse(JSON.parse('{"grade": 85.0}'))).toEqual({ grade: 85 });
  });

  it.each([-1, 101, -100, 1000, 1e9, Number.MAX_SAFE_INTEGER])("refuses %s, outside 0-100, with one message", (grade) => {
    expect(messages({ grade })).toEqual([MESSAGE]);
  });

  it.each([85.5, 0.1, 99.99, -0.5])("refuses %s, which is not a whole number, with one message", (grade) => {
    expect(messages({ grade })).toEqual([MESSAGE]);
  });

  it.each([
    ["a text", "85"],
    ["an empty text", ""],
    ["a boolean", true],
    ["a list", [85]],
    ["an object", { value: 85 }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a bigint", BigInt(85)],
  ])("refuses %s", (_label, grade) => {
    expect(messages({ grade })).toEqual([MESSAGE]);
  });

  it("needs the grade: missing or undefined is refused, null is how it is cleared", () => {
    expect(messages({})).toEqual([MESSAGE]);
    expect(messages({ grade: undefined })).toEqual([MESSAGE]);
  });

  it("ignores other fields, so the status and the teacher cannot be sent", () => {
    expect(updateGradeSchema.parse({ grade: 70, status: "CHECKED", teacherId: "x", studentId: "y" })).toEqual({ grade: 70 });
  });

  it("refuses a body that is not an object", () => {
    for (const input of [null, "text", 5, [], undefined]) expect(updateGradeSchema.safeParse(input).success).toBe(false);
  });
});
