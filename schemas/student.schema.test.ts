import { describe, expect, it } from "vitest";
import { createStudentSchema } from "./student.schema";

const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
const valid = { name: "נועה לוי", phone: "050-1234567", classId: CLASS_ID };

const fieldsWith = (overrides: Record<string, unknown>): string[] => {
  const result = createStudentSchema.safeParse({ ...valid, ...overrides });
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
};

const messagesFor = (field: string, overrides: Record<string, unknown>): string[] => {
  const result = createStudentSchema.safeParse({ ...valid, ...overrides });
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
};

describe("createStudentSchema: valid input", () => {
  it("accepts a valid student", () => {
    expect(createStudentSchema.parse(valid)).toEqual(valid);
  });

  it("trims the name and the phone", () => {
    const parsed = createStudentSchema.parse({ ...valid, name: "  נועה לוי  ", phone: " 050-1234567 " });

    expect(parsed.name).toBe("נועה לוי");
    expect(parsed.phone).toBe("050-1234567");
  });

  it("ignores fields that are not part of the student", () => {
    const parsed = createStudentSchema.parse({ ...valid, teacherId: "x", id: "y", extra: 1 });

    expect(parsed).toEqual(valid);
  });

  it.each([
    ["Hebrew with a space", "בן דוד"],
    ["Hebrew with a hyphen", "בן-דוד"],
    ["Hebrew with a geresh", "ג'ורג'"],
    ["Hebrew with the geresh character", "גׁ׳ורג׳"],
    ["Latin letters", "Anna Marie"],
    ["an apostrophe from a phone keyboard", "O’Brien"],
    ["the minimum length (2)", "אב"],
    ["the maximum length (60)", "א".repeat(60)],
  ])("accepts a name with %s", (_label, name) => {
    expect(fieldsWith({ name })).toEqual([]);
  });

  it.each(["050-1234567", "0501234567", "03-1234567", "031234567", "072-1234567"])(
    "accepts the phone %s",
    (phone) => {
      expect(fieldsWith({ phone })).toEqual([]);
    },
  );

  it.each([
    ["a mobile without a hyphen", "0501234567", "050-1234567"],
    ["a mobile with a hyphen", "050-1234567", "050-1234567"],
    ["a 07x number without a hyphen", "0721234567", "072-1234567"],
    ["a landline without a hyphen", "031234567", "03-1234567"],
    ["a landline with a hyphen", "03-1234567", "03-1234567"],
    ["a phone with spaces around it", "  0501234567  ", "050-1234567"],
  ])("saves %s in one format", (_label, phone, expected) => {
    expect(createStudentSchema.parse({ ...valid, phone }).phone).toBe(expected);
  });

  it("saves the same phone as the same text, however it was typed", () => {
    const saved = ["0501234567", "050-1234567", " 050-1234567 "].map(
      (phone) => createStudentSchema.parse({ ...valid, phone }).phone,
    );

    expect(new Set(saved).size).toBe(1);
  });
});

describe("createStudentSchema: invalid name", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "     "],
    ["one character", "א"],
    ["61 characters", "א".repeat(61)],
    ["digits", "דנה 123"],
    ["a digit only", "דנה2"],
    ["markup", "<b>דנה</b>"],
    ["a script", "דנה<script>alert(1)</script>"],
    ["symbols", "דנה@לוי"],
    ["punctuation", "דנה, לוי"],
    ["a dot", "דנה."],
    ["only apostrophes", "''"],
    ["only hyphens", "--"],
    ["an emoji", "דנה 😀"],
  ])("rejects a name that is %s", (_label, name) => {
    expect(fieldsWith({ name })).toEqual(["name"]);
  });

  it.each([
    ["a number", 123],
    ["null", null],
    ["an array", ["דנה"]],
    ["an object", { first: "דנה" }],
  ])("rejects a name that is %s", (_label, name) => {
    expect(fieldsWith({ name })).toEqual(["name"]);
  });

  it("rejects a missing name", () => {
    const withoutName: Record<string, unknown> = { ...valid };
    delete withoutName.name;

    const result = createStudentSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });
});

describe("createStudentSchema: invalid phone", () => {
  it.each([
    ["empty", ""],
    ["letters", "abcdefghij"],
    ["too short", "050-123456"],
    ["too long", "050-12345678"],
    ["not starting with 0", "5012345678"],
    ["international format", "+972501234567"],
    ["a space instead of a hyphen", "050 1234567"],
    ["two hyphens", "050--1234567"],
    ["a hyphen in the wrong place", "0501-234567"],
    ["only a code", "050"],
    ["letters in the number", "050-12a4567"],
    ["a trailing hyphen", "0501234567-"],
  ])("rejects a phone that is %s", (_label, phone) => {
    expect(fieldsWith({ phone })).toEqual(["phone"]);
  });

  it("rejects a phone that is not a string", () => {
    expect(fieldsWith({ phone: 501234567 })).toEqual(["phone"]);
  });
});

describe("createStudentSchema: invalid class id", () => {
  it.each([
    ["empty", ""],
    ["not a uuid", "abc"],
    ["a number", 123],
    ["null", null],
    ["a uuid with a wrong length", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f"],
    ["an integer id like the old schema", "1"],
  ])("rejects a class id that is %s", (_label, classId) => {
    expect(fieldsWith({ classId })).toEqual(["classId"]);
  });

  it("reports every invalid field at once", () => {
    expect(fieldsWith({ name: "", phone: "x", classId: "x" }).sort()).toEqual([
      "classId",
      "name",
      "phone",
    ]);
  });

  it("gives Hebrew messages for the form to show", () => {
    const result = createStudentSchema.safeParse({ name: "א", phone: "x", classId: "x" });
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);

    expect(messages).toContain("השם חייב להכיל לפחות 2 תווים");
    expect(messages).toContain("מספר טלפון לא תקין (לדוגמה 050-1234567)");
    expect(messages).toContain("יש לבחור כיתה");
  });

  it("gives exactly one message per field, so the form never stacks several errors under an input", () => {
    for (const name of ["", "   ", "א", "א".repeat(61), "דנה1", "''", "<b>דנה</b>"]) {
      expect(messagesFor("name", { name }), JSON.stringify(name)).toHaveLength(1);
    }
    expect(messagesFor("phone", { phone: "" })).toHaveLength(1);
    expect(messagesFor("classId", { classId: "" })).toHaveLength(1);
  });

  it("gives the matching message for each name problem", () => {
    expect(messagesFor("name", { name: "א" })).toEqual(["השם חייב להכיל לפחות 2 תווים"]);
    expect(messagesFor("name", { name: "א".repeat(61) })).toEqual(["השם יכול להכיל עד 60 תווים"]);
    expect(messagesFor("name", { name: "דנה1" })).toEqual(["השם יכול להכיל רק אותיות, רווחים, גרש ומקף"]);
    expect(messagesFor("name", { name: "''" })).toEqual(["השם חייב להכיל אותיות"]);
  });
});
