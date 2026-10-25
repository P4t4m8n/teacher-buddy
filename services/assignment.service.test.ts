import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  studentCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    assignment: { findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create },
    student: { count: mocks.studentCount },
  },
}));

import { createAssignment, findAssignment, getAssignment, getAssignments } from "./assignment.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";
const ASSIGNMENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f90";
const STUDENT_A = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
const STUDENT_B = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f62";

const expectAppError = async (promise: Promise<unknown>, expected: AppError): Promise<void> => {
  const error: unknown = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status: expected.status, message: expected.message });
};

const part = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  studentId: STUDENT_A,
  status: "TODO",
  grade: null,
  submittedAt: null,
  student: { name: "נועה לוי", class: { name: "כיתה ג׳" } },
  file: null,
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ASSIGNMENT_ID,
  title: "חיבור",
  description: "<p>הנחיות</p>",
  dueDate: new Date("2026-12-15T00:00:00.000Z"),
  students: [part()],
  ...overrides,
});

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
});

describe("getAssignments", () => {
  it("queries only the given teacher's assignments, in a stable order", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getAssignments(TEACHER_ID);

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherId: TEACHER_ID },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("counts the students and the ones who submitted, and does not carry the description", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: ASSIGNMENT_ID,
        title: "חיבור",
        dueDate: new Date("2026-12-15T00:00:00.000Z"),
        _count: { students: 5 },
        students: [{ id: "a" }, { id: "b" }],
      },
    ]);

    expect(await getAssignments(TEACHER_ID)).toEqual([
      { id: ASSIGNMENT_ID, title: "חיבור", dueDate: "2026-12-15", studentCount: 5, submittedCount: 2 },
    ]);
  });

  it("only counts a student as submitted when the status is not TODO", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getAssignments(TEACHER_ID);

    expect(mocks.findMany.mock.calls[0][0].select.students.where).toEqual({ status: { not: "TODO" } });
  });

  it("gives an empty list when there are none", async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await getAssignments(TEACHER_ID)).toEqual([]);
  });
});

describe("findAssignment", () => {
  it("asks for the assignment of this teacher only", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ASSIGNMENT_ID, teacherId: TEACHER_ID } }),
    );
  });

  it("is null when there is none, without asking for more", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect(await findAssignment(TEACHER_ID, ASSIGNMENT_ID)).toBeNull();
  });

  it.each(["abc", "", "123", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz", "' OR 1=1 --"])(
    "is null for %j, without asking the database",
    async (id) => {
      expect(await findAssignment(TEACHER_ID, id)).toBeNull();
      expect(mocks.findFirst).not.toHaveBeenCalled();
    },
  );

  it("never selects the bytes of the file", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    const select = mocks.findFirst.mock.calls[0][0].select;
    expect(select.students.select.file).toEqual({ select: { name: true, mimeType: true } });
  });

  it("orders the students by name", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(mocks.findFirst.mock.calls[0][0].select.students.orderBy).toEqual([
      { student: { name: "asc" } },
      { studentId: "asc" },
    ]);
  });

  it("gives the assignment in the shape of the client", async () => {
    mocks.findFirst.mockResolvedValue(row());

    expect(await findAssignment(TEACHER_ID, ASSIGNMENT_ID)).toEqual({
      id: ASSIGNMENT_ID,
      title: "חיבור",
      dueDate: "2026-12-15",
      description: "<p>הנחיות</p>",
      students: [
        {
          studentId: STUDENT_A,
          name: "נועה לוי",
          className: "כיתה ג׳",
          status: "TODO",
          submittedAt: null,
          grade: null,
          file: null,
        },
      ],
    });
  });

  it("shows the submit date as the day in Israel, not in UTC", async () => {
    mocks.findFirst.mockResolvedValue(
      row({
        students: [
          part({ status: "SUBMITTED", submittedAt: new Date("2026-12-14T22:30:00.000Z"), file: { name: "a.pdf", mimeType: "application/pdf" } }),
        ],
      }),
    );

    const assignment = await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(assignment?.students[0].submittedAt).toBe("2026-12-15");
  });

  it.each([
    ["application/pdf", "pdf"],
    ["image/png", "image"],
    ["image/jpeg", "image"],
    ["image/webp", "image"],
    ["text/plain", "other"],
  ])("gives a %s file the kind %s and a link to the file of that student", async (mimeType, kind) => {
    mocks.findFirst.mockResolvedValue(
      row({
        students: [part({ status: "CHECKED", grade: 90, submittedAt: new Date(), file: { name: "עבודה.x", mimeType } })],
      }),
    );

    const assignment = await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(assignment?.students[0].file).toEqual({
      name: "עבודה.x",
      kind,
      url: `/api/assignments/${ASSIGNMENT_ID}/students/${STUDENT_A}/file`,
    });
  });

  it("keeps the grade, including 0", async () => {
    mocks.findFirst.mockResolvedValue(
      row({
        students: [part({ status: "CHECKED", grade: 0, submittedAt: new Date(), file: { name: "a.pdf", mimeType: "application/pdf" } })],
      }),
    );

    expect((await findAssignment(TEACHER_ID, ASSIGNMENT_ID))?.students[0].grade).toBe(0);
  });

  it("gives every student of the assignment", async () => {
    mocks.findFirst.mockResolvedValue(row({ students: [part(), part({ studentId: STUDENT_B })] }));

    const assignment = await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(assignment?.students.map((student) => student.studentId)).toEqual([STUDENT_A, STUDENT_B]);
  });
});

describe("getAssignment", () => {
  it("gives the assignment", async () => {
    mocks.findFirst.mockResolvedValue(row());

    expect((await getAssignment(TEACHER_ID, ASSIGNMENT_ID)).id).toBe(ASSIGNMENT_ID);
  });

  it("is a 404 when there is none", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expectAppError(getAssignment(TEACHER_ID, ASSIGNMENT_ID), AppError.assignmentNotFound());
  });

  it("is the same 404 for an id that is not a uuid", async () => {
    await expectAppError(getAssignment(TEACHER_ID, "abc"), AppError.assignmentNotFound());
  });
});

describe("createAssignment", () => {
  const dto = {
    title: "חיבור",
    description: "<p>הנחיות</p>",
    dueDate: "2026-12-15",
    studentIds: [STUDENT_A, STUDENT_B],
  };

  it("checks the students are this teacher's before it creates anything", async () => {
    mocks.studentCount.mockResolvedValue(1);

    await expectAppError(createAssignment(TEACHER_ID, dto), AppError.studentNotFound());

    expect(mocks.studentCount).toHaveBeenCalledWith({
      where: { id: { in: [STUDENT_A, STUDENT_B] }, teacherId: TEACHER_ID },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("is a 404 when none of the students exist", async () => {
    mocks.studentCount.mockResolvedValue(0);

    await expectAppError(createAssignment(TEACHER_ID, dto), AppError.studentNotFound());
  });

  it("creates the assignment and its students in one statement, for the given teacher", async () => {
    mocks.studentCount.mockResolvedValue(2);
    mocks.create.mockResolvedValue(row({ students: [part(), part({ studentId: STUDENT_B })] }));

    await createAssignment(TEACHER_ID, dto);

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].data).toEqual({
      teacherId: TEACHER_ID,
      title: "חיבור",
      description: "<p>הנחיות</p>",
      dueDate: new Date("2026-12-15T00:00:00.000Z"),
      students: { create: [{ studentId: STUDENT_A }, { studentId: STUDENT_B }] },
    });
  });

  it("gives back the assignment as the client reads it", async () => {
    mocks.studentCount.mockResolvedValue(1);
    mocks.create.mockResolvedValue(row());

    expect(await createAssignment(TEACHER_ID, { ...dto, studentIds: [STUDENT_A] })).toMatchObject({
      id: ASSIGNMENT_ID,
      dueDate: "2026-12-15",
      students: [{ studentId: STUDENT_A, status: "TODO", grade: null, file: null }],
    });
  });

  it("is a 404 when a student was deleted after the check", async () => {
    mocks.studentCount.mockResolvedValue(2);
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" }),
    );

    await expectAppError(createAssignment(TEACHER_ID, dto), AppError.studentNotFound());
  });

  it("does not hide other database errors", async () => {
    mocks.studentCount.mockResolvedValue(2);
    const failure = new Error("connection lost");
    mocks.create.mockRejectedValue(failure);

    await expect(createAssignment(TEACHER_ID, dto)).rejects.toBe(failure);
  });
});
