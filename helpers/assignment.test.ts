import { describe, expect, it } from "vitest";
import type { TAssignmentStudent, TTeacherAssignment } from "@/types/assignment.type";
import {
  canGrade,
  countSubmitted,
  deriveStatus,
  getFileKind,
  toFormValues,
  toStudentAssignment,
  toSubmittedParts,
} from "./assignment";

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

describe("getFileKind", () => {
  it("shows a PDF in a frame", () => {
    expect(getFileKind("application/pdf")).toBe("pdf");
  });

  it.each(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])("shows %s as an image", (type) => {
    expect(getFileKind(type)).toBe("image");
  });

  it.each(["text/plain", "application/zip", "application/octet-stream", "", "pdf", "application/PDF"])(
    "shows %j only by its name",
    (type) => {
      expect(getFileKind(type)).toBe("other");
    },
  );
});

describe("deriveStatus", () => {
  it("is TODO while there is no file", () => {
    expect(deriveStatus(false, null)).toBe("TODO");
  });

  it("is SUBMITTED once there is a file and no grade yet", () => {
    expect(deriveStatus(true, null)).toBe("SUBMITTED");
  });

  it("is CHECKED once there is a file and a grade", () => {
    expect(deriveStatus(true, 90)).toBe("CHECKED");
  });

  it("counts a grade of zero as a grade", () => {
    expect(deriveStatus(true, 0)).toBe("CHECKED");
  });

  it("has no state for a grade without a file: it is TODO, and the grade is not allowed", () => {
    expect(deriveStatus(false, 90)).toBe("TODO");
    expect(canGrade(false)).toBe(false);
  });
});

describe("canGrade", () => {
  it("is possible only when a file was uploaded", () => {
    expect(canGrade(true)).toBe(true);
    expect(canGrade(false)).toBe(false);
  });
});

describe("countSubmitted", () => {
  it("counts the students whose assignment was uploaded, checked or not", () => {
    const given = assignment([
      student({ studentId: "s1", status: "SUBMITTED" }),
      student({ studentId: "s2", status: "TODO" }),
      student({ studentId: "s3", status: "CHECKED" }),
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
    const submitted = student({ studentId: "s7", status: "SUBMITTED", submittedAt: "2026-12-10", grade: 90, file });

    expect(toStudentAssignment(given, submitted)).toEqual({
      id: "a1",
      studentId: "s7",
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

describe("toSubmittedParts", () => {
  const file = { name: "עבודה.pdf", kind: "pdf" as const, url: "/f" };

  it("gives the students who uploaded, with their name and grade, and leaves out those who did not", () => {
    const given = assignment([
      student({ studentId: "s1", name: "נועה לוי" }),
      student({ studentId: "s2", name: "איתי ברק", status: "SUBMITTED", submittedAt: "2026-12-10", file }),
      student({ studentId: "s3", name: "מאיה אברהם", status: "CHECKED", submittedAt: "2026-12-11", grade: 88, file }),
    ]);

    expect(toSubmittedParts(given)).toEqual([
      { studentId: "s2", name: "איתי ברק", grade: null },
      { studentId: "s3", name: "מאיה אברהם", grade: 88 },
    ]);
  });

  it("keeps a grade of 0", () => {
    const given = assignment([student({ status: "CHECKED", submittedAt: "2026-12-11", grade: 0, file })]);

    expect(toSubmittedParts(given)[0].grade).toBe(0);
  });

  it("is empty when nobody uploaded, and for an assignment given to nobody", () => {
    expect(toSubmittedParts(assignment([student(), student({ studentId: "s2" })]))).toEqual([]);
    expect(toSubmittedParts(assignment([]))).toEqual([]);
  });

  it("does not carry the file or the date: the form only needs to name the student and say what is lost", () => {
    const given = assignment([student({ status: "SUBMITTED", submittedAt: "2026-12-10", file })]);

    expect(Object.keys(toSubmittedParts(given)[0]).sort()).toEqual(["grade", "name", "studentId"]);
  });
});
