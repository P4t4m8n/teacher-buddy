import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/constants/error.constant";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  findUniqueOrThrow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const tx = {
    assignmentStudent: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
    submissionFile: { upsert: mocks.upsert },
  };
  return { prisma: { $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx) } };
});

import { uploadSubmission } from "./submission.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";
const ASSIGNMENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f90";
const STUDENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
const PART_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fa1";

const pdf = (name: string = "עבודה.pdf"): File => new File(["%PDF-1.7 content"], name, { type: "application/pdf" });

const expectAppError = async (promise: Promise<unknown>, expected: AppError): Promise<void> => {
  const error: unknown = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status: expected.status, message: expected.message });
};

const partRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  studentId: STUDENT_ID,
  status: "SUBMITTED",
  grade: null,
  submittedAt: new Date("2026-10-25T10:00:00.000Z"),
  student: { name: "נועה לוי", class: { name: "כיתה ג׳" } },
  file: { name: "עבודה.pdf", mimeType: "application/pdf" },
  ...overrides,
});

const found = (grade: number | null = null): void => {
  mocks.findFirst.mockResolvedValue({ id: PART_ID, grade });
  mocks.update.mockResolvedValue({});
  mocks.upsert.mockResolvedValue({});
  mocks.findUniqueOrThrow.mockResolvedValue(partRow());
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("uploadSubmission", () => {
  it.each([
    ["the assignment id", "abc", STUDENT_ID],
    ["the student id", ASSIGNMENT_ID, "abc"],
    ["both ids", "' OR 1=1 --", ""],
  ])("is a 404 when %s is not a uuid, without touching the database", async (_label, assignmentId, studentId) => {
    await expectAppError(uploadSubmission(TEACHER_ID, assignmentId, studentId, pdf()), AppError.assignmentNotFound());

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["text", "hello"],
    ["HTML", "<html><script>alert(1)</script></html>"],
    ["an SVG", '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
  ])("is a 400 for %s, even when the name and the type say PDF, and saves nothing", async (_label, content) => {
    const file = new File([content], "work.pdf", { type: "application/pdf" });

    const error: unknown = await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, file).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toMatchObject({ status: 400, fields: { file: [ERROR_MESSAGES.unsupportedFile] } });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("looks for the part of this teacher's assignment only", async () => {
    found();

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf());

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: STUDENT_ID, assignment: { teacherId: TEACHER_ID } },
      select: { id: true, grade: true },
    });
  });

  it("is a 404 when there is no such part, and saves nothing", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expectAppError(uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf()), AppError.assignmentNotFound());

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("saves the file with the type found in its bytes, the cleaned name and the real size", async () => {
    found();
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])], "C:\\fakepath\\scan.pdf", {
      type: "application/pdf",
    });

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, png);

    const { create, update, where } = mocks.upsert.mock.calls[0][0];
    expect(where).toEqual({ assignmentStudentId: PART_ID });
    expect(create).toMatchObject({ assignmentStudentId: PART_ID, name: "scan.pdf", mimeType: "image/png", size: 10 });
    expect(update).toMatchObject({ name: "scan.pdf", mimeType: "image/png", size: 10 });
    expect(Array.from(create.data)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  });

  it("replaces the file of a part that already has one (the same upsert)", async () => {
    found();

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf());

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0].update).toBeDefined();
  });

  it("makes a part with no grade SUBMITTED, on the day of the upload", async () => {
    found(null);
    const before = Date.now();

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf());

    const { where, data } = mocks.update.mock.calls[0][0];
    expect(where).toEqual({ id: PART_ID });
    expect(data.status).toBe("SUBMITTED");
    expect(data.submittedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.submittedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it.each([0, 55, 100])("keeps a part with a grade of %i CHECKED, and does not change the grade", async (grade) => {
    found(grade);

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf());

    const { data } = mocks.update.mock.calls[0][0];
    expect(data.status).toBe("CHECKED");
    expect(data).not.toHaveProperty("grade");
  });

  it("locks the part before it saves the file, so two uploads cannot run together", async () => {
    found();

    await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf());

    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
  });

  it("gives back the part as the client reads it, with a link to the file and no bytes", async () => {
    found();

    expect(await uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf())).toEqual({
      studentId: STUDENT_ID,
      name: "נועה לוי",
      className: "כיתה ג׳",
      status: "SUBMITTED",
      submittedAt: "2026-10-25",
      grade: null,
      file: {
        name: "עבודה.pdf",
        kind: "pdf",
        url: `/api/assignments/${ASSIGNMENT_ID}/students/${STUDENT_ID}/file`,
      },
    });
    expect(mocks.findUniqueOrThrow.mock.calls[0][0].select.file).toEqual({ select: { name: true, mimeType: true } });
  });

  it("does not hide database errors", async () => {
    found();
    const failure = new Error("connection lost");
    mocks.upsert.mockRejectedValue(failure);

    await expect(uploadSubmission(TEACHER_ID, ASSIGNMENT_ID, STUDENT_ID, pdf())).rejects.toBe(failure);
  });
});
