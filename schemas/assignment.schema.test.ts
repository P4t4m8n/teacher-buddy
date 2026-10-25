import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAssignmentSchema } from "./assignment.schema";

const STUDENT_A = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
const STUDENT_B = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f62";
const valid = {
  title: "עבודה על המהפכה התעשייתית",
  description: "<p>הנחיות</p>",
  dueDate: "2026-12-15",
  studentIds: [STUDENT_A],
};

const fieldsWith = (overrides: Record<string, unknown>): string[] => {
  const result = createAssignmentSchema.safeParse({ ...valid, ...overrides });
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
};

const messagesFor = (field: string, overrides: Record<string, unknown>): string[] => {
  const result = createAssignmentSchema.safeParse({ ...valid, ...overrides });
  if (result.success) return [];
  return result.error.issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
};

const without = (field: string): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...valid };
  delete copy[field];
  return copy;
};

describe("createAssignmentSchema: valid input", () => {
  it("accepts a valid assignment, and gives it back as it is", () => {
    expect(createAssignmentSchema.parse(valid)).toEqual(valid);
  });

  it("trims the title", () => {
    expect(createAssignmentSchema.parse({ ...valid, title: "   חיבור   " }).title).toBe("חיבור");
  });

  it("ignores fields that are not part of an assignment, so a request cannot choose the teacher or the id", () => {
    const parsed = createAssignmentSchema.parse({ ...valid, teacherId: "x", id: "y", status: "CHECKED", extra: 1 });

    expect(parsed).toEqual(valid);
  });

  it.each([
    ["Hebrew with punctuation", "חיבור: המסע שלי"],
    ["Hebrew, a hyphen and a number", "תרגילי חשבון - פרק 4"],
    ["English", "Essay about the sea"],
    ["only digits", "12"],
    ["quotes and a question mark", 'מה זה "חשבון"?'],
    ["the minimum length (2)", "אב"],
    ["the maximum length (100)", "א".repeat(100)],
  ])("accepts a title with %s", (_label, title) => {
    expect(fieldsWith({ title })).toEqual([]);
  });

  it.each([
    ["the first day of the first year", "2000-01-01"],
    ["the last day of the last year", "2100-12-31"],
    ["a leap day", "2028-02-29"],
    ["a day in the past", "2020-05-05"],
  ])("accepts a due date that is %s", (_label, dueDate) => {
    expect(fieldsWith({ dueDate })).toEqual([]);
  });
});

describe("createAssignmentSchema: the title", () => {
  it("is required", () => {
    expect(fieldsWith({ title: undefined })).toEqual(["title"]);
    expect(messagesFor("title", { title: undefined })).toEqual(["יש להזין שם למטלה"]);
  });

  it.each([
    ["a number", 5],
    ["null", null],
    ["an object", { name: "א" }],
  ])("is rejected when it is %s", (_label, title) => {
    expect(messagesFor("title", { title })).toEqual(["יש להזין שם למטלה"]);
  });

  it("is rejected when it is a list, and the first message is the one that matters", () => {
    expect(messagesFor("title", { title: ["א"] })[0]).toBe("יש להזין שם למטלה");
  });

  it.each([
    ["empty", ""],
    ["only spaces", "      "],
    ["one character", "א"],
  ])("must have 2 characters at least: %s is too short", (_label, title) => {
    expect(messagesFor("title", { title })).toEqual(["שם המטלה חייב להכיל לפחות 2 תווים"]);
  });

  it("can have 100 characters at most", () => {
    expect(messagesFor("title", { title: "א".repeat(101) })).toEqual(["שם המטלה יכול להכיל עד 100 תווים"]);
  });

  it.each(["!!", "...", "- -", "??"])("must have a letter or a digit: %j has none", (title) => {
    expect(messagesFor("title", { title })).toEqual(["שם המטלה חייב להכיל אותיות או ספרות"]);
  });

  it("has one message at a time, never a stack", () => {
    expect(messagesFor("title", { title: "!" })).toHaveLength(1);
  });
});

describe("createAssignmentSchema: the description", () => {
  it("is optional, and empty when missing", () => {
    expect(createAssignmentSchema.parse(without("description")).description).toBe("");
  });

  it("can be empty", () => {
    expect(createAssignmentSchema.parse({ ...valid, description: "" }).description).toBe("");
  });

  it("is cleaned: what the editor cannot make is removed", () => {
    const parsed = createAssignmentSchema.parse({
      ...valid,
      description: '<p onclick="x()">שלום</p><script>alert(1)</script><a href="https://x.co">קישור</a>',
    });

    expect(parsed.description).toBe("<p>שלום</p>קישור");
  });

  it("keeps what the editor makes", () => {
    const html = "<h2>הנחיות</h2><p>יש <strong>לכתוב</strong> <em>היטב</em></p><ul><li><p>אחד</p></li></ul>";

    expect(createAssignmentSchema.parse({ ...valid, description: html }).description).toBe(html);
  });

  it("is empty when nothing is left after it is cleaned", () => {
    expect(createAssignmentSchema.parse({ ...valid, description: "<p></p>" }).description).toBe("");
    expect(createAssignmentSchema.parse({ ...valid, description: "<script>x</script>" }).description).toBe("");
  });

  it.each([
    ["a number", 5],
    ["null", null],
    ["a list", ["<p>א</p>"]],
  ])("is rejected when it is %s", (_label, description) => {
    expect(messagesFor("description", { description })).toEqual(["התיאור אינו תקין"]);
  });

  it("can have 20,000 characters at most", () => {
    expect(fieldsWith({ description: `<p>${"א".repeat(19_990)}</p>` })).toEqual([]);
    expect(messagesFor("description", { description: "א".repeat(20_001) })).toEqual([
      "התיאור יכול להכיל עד 20,000 תווים",
    ]);
  });
});

describe("createAssignmentSchema: the due date", () => {
  it("is required", () => {
    expect(messagesFor("dueDate", { dueDate: undefined })).toEqual(["תאריך ההגשה אינו תקין"]);
  });

  it.each([
    ["empty", ""],
    ["in the Israeli format", "15.12.2026"],
    ["with the day first", "15-12-2026"],
    ["with slashes", "2026/12/15"],
    ["with a time", "2026-12-15T10:00:00Z"],
    ["a day that does not exist in the month", "2026-02-30"],
    ["a month that does not exist", "2026-13-01"],
    ["day zero", "2026-12-00"],
    ["the 29th of February in a year that is not a leap year", "2027-02-29"],
    ["words", "מחר"],
    ["a number", 20261215],
    ["null", null],
  ])("is rejected when it is %s", (_label, dueDate) => {
    expect(messagesFor("dueDate", { dueDate })).toEqual(["תאריך ההגשה אינו תקין"]);
  });

  it.each(["1999-12-31", "2101-01-01", "0001-01-01", "9999-12-31"])("must be between the years 2000 and 2100: %s is not", (dueDate) => {
    expect(messagesFor("dueDate", { dueDate })).toEqual(["תאריך ההגשה חייב להיות בין השנים 2000 ל-2100"]);
  });
});

describe("createAssignmentSchema: the students", () => {
  it("are required", () => {
    expect(messagesFor("studentIds", { studentIds: undefined })).toEqual(["יש לבחור לפחות תלמיד אחד"]);
  });

  it("need at least one student", () => {
    expect(messagesFor("studentIds", { studentIds: [] })).toEqual(["יש לבחור לפחות תלמיד אחד"]);
  });

  it.each([
    ["a text", STUDENT_A],
    ["a number", 5],
    ["null", null],
    ["an object", { id: STUDENT_A }],
  ])("must be a list: %s is not", (_label, studentIds) => {
    expect(messagesFor("studentIds", { studentIds })).toEqual(["יש לבחור לפחות תלמיד אחד"]);
  });

  it.each([
    ["words", ["abc"]],
    ["an empty text", [""]],
    ["a number", [1]],
    ["null", [null]],
    ["a uuid with a letter that does not belong", ["0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz"]],
    ["one good id and one bad", [STUDENT_A, "abc"]],
  ])("must all be ids: %s are not", (_label, studentIds) => {
    expect(messagesFor("studentIds", { studentIds })).toContain("יש לבחור תלמידים תקינים");
  });

  it("can be as many as 500", () => {
    const many = Array.from({ length: 500 }, (_, index: number) => `0198f0a2-7b3c-7d4e-8f5a-${String(index).padStart(12, "0")}`);

    expect(fieldsWith({ studentIds: many })).toEqual([]);
    expect(messagesFor("studentIds", { studentIds: [...many, STUDENT_B] })).toEqual(["ניתן לבחור עד 500 תלמידים"]);
  });

  it("count a student chosen twice once", () => {
    const parsed = createAssignmentSchema.parse({ ...valid, studentIds: [STUDENT_A, STUDENT_B, STUDENT_A] });

    expect(parsed.studentIds).toEqual([STUDENT_A, STUDENT_B]);
  });

  it("keep the order they were chosen in", () => {
    expect(createAssignmentSchema.parse({ ...valid, studentIds: [STUDENT_B, STUDENT_A] }).studentIds).toEqual([
      STUDENT_B,
      STUDENT_A,
    ]);
  });
});

describe("createAssignmentSchema: the whole request", () => {
  it("reports every field that is wrong, and only those", () => {
    expect(fieldsWith({ title: "", dueDate: "x", studentIds: [] }).sort()).toEqual(["dueDate", "studentIds", "title"]);
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, "text", 5, [], undefined]) {
      expect(createAssignmentSchema.safeParse(body).success).toBe(false);
    }
  });

  it("gives every message in Hebrew", () => {
    const result = createAssignmentSchema.safeParse({ title: 1, description: 1, dueDate: 1, studentIds: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      for (const { message } of result.error.issues) expect(message).toMatch(/[\u05D0-\u05EA]/);
    }
  });
});
