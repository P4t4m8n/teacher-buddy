import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/file";
import { createSamplePdf } from "./sample-pdf";
import { PAGE_SIZE } from "../constants/list.constant";
import { DEMO_EXTRA, DEMO_SEED, SEED_TEACHERS, type TSeedAssignment, type TSeedStudent, type TSeedTeacher } from "./seed-data";

const text = (bytes: Uint8Array): string => Array.from(bytes, (byte: number) => String.fromCharCode(byte)).join("");

describe("createSamplePdf", () => {
  const pdf: string = text(createSamplePdf("Sample submission"));

  it("is a PDF as the upload check knows it", () => {
    expect(detectFileType(createSamplePdf("x"))).toBe("application/pdf");
  });

  it("is a small file, well under the upload limit", () => {
    expect(createSamplePdf("Sample submission").byteLength).toBeLessThan(2000);
  });

  it("has the text, one page and the end marker", () => {
    expect(pdf).toContain("(Sample submission) Tj");
    expect(pdf).toContain("/Count 1");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("has a cross-reference table whose offsets point at each object", () => {
    const startxref: number = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

    const offsets: number[] = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset: number, index: number) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  it("has a stream whose length is what it says", () => {
    const match = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf);

    expect(Number(match?.[1])).toBe(match?.[2].length);
  });

  it("is only ASCII, so each character is one byte", () => {
    expect(createSamplePdf("Sample submission").every((byte: number) => byte < 128)).toBe(true);
  });
});

const studentsOf = (seed: TSeedTeacher): string[] => seed.classes.flatMap(({ students }) => students.map(({ name }) => name));

describe("the seed assignments", () => {
  const withAssignments: TSeedTeacher[] = SEED_TEACHERS.filter(({ assignments }) => assignments?.length);

  it("are only given to the teachers that tests may read, not to the ones that tests change", () => {
    expect(withAssignments.map(({ name }) => name).sort()).toEqual(["דנה כהן", "יוסי מזרחי"].sort());
  });

  it.each(withAssignments.map((seed) => [seed.name, seed] as const))("%s: every part is a student of that teacher", (_name, seed) => {
    const students: string[] = studentsOf(seed);

    for (const assignment of seed.assignments ?? []) {
      for (const part of assignment.parts) expect(students, `${assignment.title}: ${part.student}`).toContain(part.student);
    }
  });

  it.each(withAssignments.map((seed) => [seed.name, seed] as const))("%s: a student is only once in an assignment", (_name, seed) => {
    for (const { parts, title } of seed.assignments ?? []) {
      const names: string[] = parts.map(({ student }) => student);
      expect(new Set(names).size, title).toBe(names.length);
    }
  });

  it.each(withAssignments.map((seed) => [seed.name, seed] as const))("%s: a grade only comes with a submission, and is a whole number from 0 to 100", (_name, seed) => {
    for (const { parts } of seed.assignments ?? []) {
      for (const { grade, submittedAt, student } of parts) {
        if (grade === undefined) continue;
        expect(submittedAt, student).toBeDefined();
        expect(Number.isInteger(grade) && grade >= 0 && grade <= 100, student).toBe(true);
      }
    }
  });

  it.each(withAssignments.map((seed) => [seed.name, seed] as const))("%s: the dates are real days", (_name, seed) => {
    const isRealDay = (value: string): boolean => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().startsWith(value);
    };

    for (const { dueDate, parts, title } of seed.assignments ?? []) {
      expect(isRealDay(dueDate), title).toBe(true);
      for (const { submittedAt } of parts) if (submittedAt) expect(isRealDay(submittedAt), title).toBe(true);
    }
  });

  it("the demo teacher shows every status: TODO, SUBMITTED and CHECKED", () => {
    const parts = SEED_TEACHERS[0].assignments?.flatMap(({ parts }) => parts) ?? [];

    expect(parts.some(({ submittedAt }) => submittedAt === undefined)).toBe(true);
    expect(parts.some(({ submittedAt, grade }) => submittedAt !== undefined && grade === undefined)).toBe(true);
    expect(parts.some(({ grade }) => grade !== undefined)).toBe(true);
  });

  it("the titles of one teacher are different, so a test can find an assignment by its title", () => {
    for (const { assignments } of withAssignments) {
      const titles: string[] = (assignments ?? []).map(({ title }) => title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

const coreStudents: TSeedStudent[] = DEMO_SEED.classes.flatMap(({ students }) => students);
const extraStudents: TSeedStudent[] = DEMO_EXTRA.classes.flatMap(({ students }) => students);
const allStudents: TSeedStudent[] = [...coreStudents, ...extraStudents];
const coreAssignments: TSeedAssignment[] = DEMO_SEED.assignments ?? [];
const allAssignments: TSeedAssignment[] = [...coreAssignments, ...DEMO_EXTRA.assignments];

describe("the demo teacher's data: the core part, which the e2e tests count", () => {
  it("is still 10 students and 4 assignments, so the tests that count them keep passing", () => {
    expect(coreStudents).toHaveLength(10);
    expect(coreAssignments).toHaveLength(4);
  });

  it("is not changed by the extra data: DEMO_SEED has none of it", () => {
    const coreNames = new Set<string>(coreStudents.map(({ name }) => name));

    expect(extraStudents.some(({ name }) => coreNames.has(name))).toBe(false);
    expect(DEMO_SEED.classes.map(({ name }) => name)).toEqual(["ח'1", "ח'2", "ט'1", "י'1"]);
  });

  it("is the only data of the demo teacher that the seed list has: the extra part is added by the seed script", () => {
    expect(SEED_TEACHERS[0]).toBe(DEMO_SEED);
  });
});

describe("the demo teacher's data: with the extra part", () => {
  it("has 45 students and 45 assignments, so each list has more than one page", () => {
    expect(allStudents).toHaveLength(45);
    expect(allAssignments).toHaveLength(45);
    expect(Math.ceil(allStudents.length / PAGE_SIZE)).toBeGreaterThan(1);
    expect(Math.ceil(allAssignments.length / PAGE_SIZE)).toBeGreaterThan(1);
  });

  it("has students that are all different: by name, and by phone", () => {
    expect(new Set(allStudents.map(({ name }) => name)).size).toBe(45);
    expect(new Set(allStudents.map(({ phone }) => phone)).size).toBe(45);
  });

  it("has phones in the format the app saves", () => {
    for (const { phone } of allStudents) expect(phone).toMatch(/^0\d{1,2}-\d{7}$/);
  });

  it("has names the student form accepts: letters, spaces, and nothing else", () => {
    for (const { name } of extraStudents) {
      expect(name).toMatch(/^[\p{L}\p{M}' \-]+$/u);
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(name.length).toBeLessThanOrEqual(60);
    }
  });

  it("puts the extra students in classes, adding to the demo teacher's classes and to new ones", () => {
    const names: string[] = DEMO_EXTRA.classes.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["ח'1", "ח'2", "ט'1", "ח'3", "ט'2"]));
    expect(DEMO_EXTRA.classes.every(({ students }) => students.length > 0)).toBe(true);
  });

  it("does not use the class that is empty on purpose, so deleting a class can still be tried", () => {
    expect(DEMO_EXTRA.classes.map(({ name }) => name)).not.toContain("י'1");
  });

  it("has assignments with different titles", () => {
    expect(new Set(allAssignments.map(({ title }) => title)).size).toBe(45);
  });

  it("has assignments with a real due date, and a title and a description that the form accepts", () => {
    for (const { title, description, dueDate } of DEMO_EXTRA.assignments) {
      expect(dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${dueDate}T00:00:00.000Z`).getTime())).toBe(false);
      expect(title.length).toBeGreaterThanOrEqual(2);
      expect(title.length).toBeLessThanOrEqual(100);
      expect(description).toMatch(/^<p>[^<]+<\/p>$/);
    }
  });

  it("has due dates that are all different, so the order by date is clear", () => {
    expect(new Set(DEMO_EXTRA.assignments.map(({ dueDate }) => dueDate)).size).toBe(DEMO_EXTRA.assignments.length);
  });

  it("gives every assignment to students that exist, each at most once, and at least one", () => {
    const known = new Set<string>(allStudents.map(({ name }) => name));

    for (const { title, parts } of DEMO_EXTRA.assignments) {
      expect(parts.length, title).toBeGreaterThan(0);
      expect(parts.length, title).toBeLessThanOrEqual(6);
      expect(new Set(parts.map(({ student }) => student)).size, title).toBe(parts.length);
      for (const { student } of parts) expect(known.has(student), `${title}: ${student}`).toBe(true);
    }
  });

  it("never has a grade without an upload, and has grades from 0 to 100 that are whole numbers", () => {
    for (const { parts } of DEMO_EXTRA.assignments) {
      for (const { submittedAt, grade } of parts) {
        if (grade === undefined) continue;
        expect(submittedAt).toBeDefined();
        expect(Number.isInteger(grade)).toBe(true);
        expect(grade).toBeGreaterThanOrEqual(0);
        expect(grade).toBeLessThanOrEqual(100);
      }
    }
  });

  it("has uploads on real days", () => {
    for (const { parts } of DEMO_EXTRA.assignments) {
      for (const { submittedAt } of parts) {
        if (submittedAt === undefined) continue;
        expect(new Date(`${submittedAt}T00:00:00.000Z`).toISOString().startsWith(submittedAt)).toBe(true);
      }
    }
  });

  it("has every state: not submitted, submitted and checked", () => {
    const parts = DEMO_EXTRA.assignments.flatMap((assignment) => assignment.parts);

    expect(parts.some(({ submittedAt }) => submittedAt === undefined)).toBe(true);
    expect(parts.some(({ submittedAt, grade }) => submittedAt !== undefined && grade === undefined)).toBe(true);
    expect(parts.some(({ grade }) => grade !== undefined)).toBe(true);
  });

  it("has uploads that are late and uploads that are early", () => {
    const offsets: number[] = DEMO_EXTRA.assignments.flatMap(({ dueDate, parts }) =>
      parts.flatMap(({ submittedAt }) =>
        submittedAt === undefined ? [] : [Math.round((new Date(`${submittedAt}T00:00:00Z`).getTime() - new Date(`${dueDate}T00:00:00Z`).getTime()) / 86_400_000)],
      ),
    );

    expect(Math.max(...offsets)).toBeGreaterThan(0);
    expect(Math.min(...offsets)).toBeLessThan(0);
  });

  it("is the same every time: made by code, with nothing random", () => {
    expect(DEMO_EXTRA.assignments[0].title).toBe("תרגיל - חשבון (1)");
    expect(extraStudents[0]).toEqual({ name: "אדם אביטל", phone: "050-3000001" });
  });
});
