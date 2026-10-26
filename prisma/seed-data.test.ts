import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/file";
import { createSamplePdf } from "./sample-pdf";
import { SEED_TEACHERS, type TSeedTeacher } from "./seed-data";

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
