import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_STATUS_LABELS,
  getAssignmentEditPage,
  getAssignmentPage,
  MAX_FILE_SIZE,
  MAX_GRADE,
  MIN_GRADE,
} from "./assignment.constant";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const LATIN_LETTER = /[A-Za-z]/;

describe("ASSIGNMENT_STATUS_LABELS", () => {
  it("has a label for every status, and only for them", () => {
    expect(Object.keys(ASSIGNMENT_STATUS_LABELS).sort()).toEqual(["CHECKED", "SUBMITTED", "TODO"]);
  });

  it("has the labels of the three statuses", () => {
    expect(ASSIGNMENT_STATUS_LABELS).toEqual({ TODO: "לביצוע", SUBMITTED: "הוגשה", CHECKED: "נבדקה" });
  });

  it.each(Object.entries(ASSIGNMENT_STATUS_LABELS))("%s is written in Hebrew, with no English words", (_key, label) => {
    expect(label).toMatch(HEBREW_LETTER);
    expect(label).not.toMatch(LATIN_LETTER);
  });

  it("has no duplicated labels", () => {
    const labels: string[] = Object.values(ASSIGNMENT_STATUS_LABELS);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("the limits", () => {
  it("has a grade from 0 to 100", () => {
    expect([MIN_GRADE, MAX_GRADE]).toEqual([0, 100]);
  });

  it("has a file limit of 4 MB, under the 4.5 MB request limit of Vercel", () => {
    expect(MAX_FILE_SIZE).toBe(4 * 1024 * 1024);
    expect(MAX_FILE_SIZE).toBeLessThan(4.5 * 1024 * 1024);
  });
});

describe("page addresses", () => {
  it("builds the address of an assignment and of its edit page", () => {
    expect(getAssignmentPage("abc")).toBe("/dashboard/assignments/abc");
    expect(getAssignmentEditPage("abc")).toBe("/dashboard/assignments/abc/edit");
  });
});
