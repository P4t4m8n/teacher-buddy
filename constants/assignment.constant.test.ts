import { describe, expect, it } from "vitest";
import { deriveStatus } from "@/helpers/assignment";
import type { TAssignmentStatus } from "@/types/assignment.type";
import type { TStudent } from "@/types/student.type";
import {
  ASSIGNMENT_STATUS_LABELS,
  getAssignmentEditPage,
  getAssignmentPage,
  getSampleTeacherAssignments,
  MAX_GRADE,
  MIN_GRADE,
  SAMPLE_STUDENT_ASSIGNMENTS,
} from "./assignment.constant";

const HEBREW_LETTER = /[\u05D0-\u05EA]/;
const LATIN_LETTER = /[A-Za-z]/;

const STUDENTS: TStudent[] = Array.from({ length: 6 }, (_, index: number) => ({
  id: `student-${index}`,
  name: `תלמיד ${index}`,
  phone: "050-1234567",
  class: { id: "class-1", name: "ח'1" },
}));

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

describe("the grade range", () => {
  it("is 0 to 100", () => {
    expect([MIN_GRADE, MAX_GRADE]).toEqual([0, 100]);
  });
});

describe("page addresses", () => {
  it("builds the address of an assignment and of its edit page", () => {
    expect(getAssignmentPage("abc")).toBe("/dashboard/assignments/abc");
    expect(getAssignmentEditPage("abc")).toBe("/dashboard/assignments/abc/edit");
  });
});

describe("the sample data follows the rules of the statuses", () => {
  const assignments = getSampleTeacherAssignments(STUDENTS);
  const parts = assignments.flatMap(({ students }) => students);

  it("has every status at least once, so the screens can show all three", () => {
    const statuses = new Set<TAssignmentStatus>(parts.map(({ status }) => status));

    expect(statuses).toEqual(new Set(["TODO", "SUBMITTED", "CHECKED"]));
  });

  it.each(parts.map((part) => [`${part.name}: ${part.status}`, part] as const))(
    "%s has the status that its file and grade give",
    (_label, part) => {
      expect(part.status).toBe(deriveStatus(part.file !== null, part.grade));
    },
  );

  it("never has a grade without a file, or a submitted date without a file", () => {
    for (const part of parts) {
      if (part.grade !== null) expect(part.file).not.toBeNull();
      expect(part.submittedAt !== null).toBe(part.file !== null);
    }
  });

  it("has grades inside the range", () => {
    for (const { grade } of parts) {
      if (grade !== null) {
        expect(grade).toBeGreaterThanOrEqual(MIN_GRADE);
        expect(grade).toBeLessThanOrEqual(MAX_GRADE);
        expect(Number.isInteger(grade)).toBe(true);
      }
    }
  });

  it("gives each assignment to a student at most once", () => {
    for (const { students } of assignments) {
      const ids: string[] = students.map(({ studentId }) => studentId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("uses the teacher's real students, and skips places that the teacher does not have", () => {
    const few = getSampleTeacherAssignments(STUDENTS.slice(0, 2));
    const ids = new Set(STUDENTS.slice(0, 2).map(({ id }) => id));

    for (const { students } of few) for (const { studentId } of students) expect(ids.has(studentId)).toBe(true);
    expect(getSampleTeacherAssignments([]).every(({ students }) => students.length === 0)).toBe(true);
  });

  it("has the first student's part of each assignment on the student's page list, the same", () => {
    const first = STUDENTS[0];
    const mine = assignments
      .map(({ id, students }) => [id, students.find(({ studentId }) => studentId === first.id)] as const)
      .filter(([, part]) => part !== undefined);

    expect(SAMPLE_STUDENT_ASSIGNMENTS.map(({ id }) => id)).toEqual(mine.map(([id]) => id));
    for (const [id, part] of mine) {
      const listed = SAMPLE_STUDENT_ASSIGNMENTS.find((assignment) => assignment.id === id)!;
      expect([listed.status, listed.grade, listed.submittedAt]).toEqual([part!.status, part!.grade, part!.submittedAt]);
    }
  });
});
