import { describe, expect, it } from "vitest";
import type { TAssignmentStudent, TTeacherAssignment } from "@/types/assignment.type";
import { countSubmitted, toFormValues, toStudentAssignment } from "./assignment";

const student = (overrides: Partial<TAssignmentStudent> = {}): TAssignmentStudent => ({
  studentId: "s1",
  name: "נועה לוי",
  className: "ח'1",
  status: "TODO",
  submittedAt: null,
  grade: null,
  file: null,
  ...overrides,
});

const assignment = (students: TAssignmentStudent[]): TTeacherAssignment => ({
  id: "a1",
  title: "חיבור",
  dueDate: "2026-12-15",
  description: "<p>תיאור</p>",
  students,
});

describe("countSubmitted", () => {
  it("counts the students who submitted", () => {
    const given = assignment([
      student({ studentId: "s1", status: "SUBMITTED" }),
      student({ studentId: "s2", status: "TODO" }),
      student({ studentId: "s3", status: "SUBMITTED" }),
    ]);

    expect(countSubmitted(given)).toBe(2);
  });

  it("is zero for no students, or when nobody submitted", () => {
    expect(countSubmitted(assignment([]))).toBe(0);
    expect(countSubmitted(assignment([student(), student({ studentId: "s2" })]))).toBe(0);
  });
});

describe("toStudentAssignment", () => {
  it("takes the status, dates, grade and file from the student, and the rest from the assignment", () => {
    const file = { name: "scan.png", kind: "image", url: "/scan.png" } as const;
    const given = assignment([]);
    const submitted = student({ status: "SUBMITTED", submittedAt: "2026-12-10", grade: 90, file });

    expect(toStudentAssignment(given, submitted)).toEqual({
      id: "a1",
      title: "נועה לוי - חיבור",
      dueDate: "2026-12-15",
      status: "SUBMITTED",
      submittedAt: "2026-12-10",
      grade: 90,
      description: "<p>תיאור</p>",
      file,
    });
  });
});

describe("toFormValues", () => {
  it("gives the form the assignment's fields and the ids of its students", () => {
    const given = assignment([student({ studentId: "s1" }), student({ studentId: "s2" })]);

    expect(toFormValues(given)).toEqual({
      title: "חיבור",
      studentIds: ["s1", "s2"],
      dueDate: "2026-12-15",
      description: "<p>תיאור</p>",
    });
  });

  it("has an empty list of students for an assignment given to nobody", () => {
    expect(toFormValues(assignment([])).studentIds).toEqual([]);
  });
});
