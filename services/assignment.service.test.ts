import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  studentCount: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  partDeleteMany: vi.fn(),
  partCount: vi.fn(),
  partCreateMany: vi.fn(),
  partFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const tx = {
    assignment: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow },
    student: { count: mocks.studentCount },
    assignmentStudent: {
      deleteMany: mocks.partDeleteMany,
      count: mocks.partCount,
      createMany: mocks.partCreateMany,
    },
  };
  return {
    prisma: {
      assignment: {
        findMany: mocks.findMany,
        findFirst: mocks.findFirst,
        create: mocks.create,
        deleteMany: mocks.deleteMany,
      },
      student: { count: mocks.studentCount },
      assignmentStudent: { findMany: mocks.partFindMany },
      $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    },
  };
});

import {
  createAssignment,
  deleteAssignment,
  findAssignment,
  getAssignment,
  getAssignments,
  getStudentAssignments,
  updateAssignment,
} from "./assignment.service";

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

  it("leaves out a student who was deleted while the assignment was read, and keeps the others", async () => {
    mocks.findFirst.mockResolvedValue(row({ students: [part({ student: null }), part({ studentId: STUDENT_B })] }));

    const assignment = await findAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(assignment?.students.map((student) => student.studentId)).toEqual([STUDENT_B]);
  });

  it("gives an assignment with no students when all of them were deleted while it was read", async () => {
    mocks.findFirst.mockResolvedValue(row({ students: [part({ student: null })] }));

    expect((await findAssignment(TEACHER_ID, ASSIGNMENT_ID))?.students).toEqual([]);
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

describe("getStudentAssignments", () => {
  const studentRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    assignmentId: ASSIGNMENT_ID,
    status: "TODO",
    grade: null,
    submittedAt: null,
    file: null,
    assignment: { title: "חיבור", description: "<p>הנחיות</p>", dueDate: new Date("2026-12-15T00:00:00.000Z") },
    ...overrides,
  });

  it("reads only the assignments of this teacher that were given to this student, newest due date first", async () => {
    mocks.partFindMany.mockResolvedValue([]);

    await getStudentAssignments(TEACHER_ID, STUDENT_A);

    expect(mocks.partFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: STUDENT_A, assignment: { teacherId: TEACHER_ID } },
        orderBy: [{ assignment: { dueDate: "desc" } }, { assignment: { createdAt: "desc" } }, { assignmentId: "asc" }],
      }),
    );
  });

  it("never selects the bytes of the file", async () => {
    mocks.partFindMany.mockResolvedValue([]);

    await getStudentAssignments(TEACHER_ID, STUDENT_A);

    expect(mocks.partFindMany.mock.calls[0][0].select.file).toEqual({ select: { name: true, mimeType: true } });
  });

  it.each(["abc", "", "123", "' OR 1=1 --"])("gives an empty list for %j, without touching the database", async (id) => {
    expect(await getStudentAssignments(TEACHER_ID, id)).toEqual([]);
    expect(mocks.partFindMany).not.toHaveBeenCalled();
  });

  it("gives an empty list when there are none", async () => {
    mocks.partFindMany.mockResolvedValue([]);

    expect(await getStudentAssignments(TEACHER_ID, STUDENT_A)).toEqual([]);
  });

  it("gives the id of the assignment and of the student, with the student's progress in the shape of the page", async () => {
    mocks.partFindMany.mockResolvedValue([studentRow()]);

    expect(await getStudentAssignments(TEACHER_ID, STUDENT_A)).toEqual([
      {
        id: ASSIGNMENT_ID,
        studentId: STUDENT_A,
        title: "חיבור",
        dueDate: "2026-12-15",
        status: "TODO",
        submittedAt: null,
        grade: null,
        description: "<p>הנחיות</p>",
        file: null,
      },
    ]);
  });

  it("gives a checked assignment its grade, its file as a link of this student, and the Israeli day of the upload", async () => {
    mocks.partFindMany.mockResolvedValue([
      studentRow({
        status: "CHECKED",
        grade: 0,
        submittedAt: new Date("2026-12-14T22:30:00.000Z"),
        file: { name: "עבודה.pdf", mimeType: "application/pdf" },
      }),
    ]);

    const [assignment] = await getStudentAssignments(TEACHER_ID, STUDENT_A);

    expect(assignment).toMatchObject({
      status: "CHECKED",
      grade: 0,
      submittedAt: "2026-12-15",
      file: {
        name: "עבודה.pdf",
        kind: "pdf",
        url: `/api/assignments/${ASSIGNMENT_ID}/students/${STUDENT_A}/file`,
      },
    });
  });

  it("keeps the order that the database gave", async () => {
    mocks.partFindMany.mockResolvedValue([
      studentRow({ assignmentId: "b" }),
      studentRow({ assignmentId: "a" }),
    ]);

    expect((await getStudentAssignments(TEACHER_ID, STUDENT_A)).map(({ id }) => id)).toEqual(["b", "a"]);
  });

  it("leaves out an assignment that was deleted while the list was read, and keeps the others", async () => {
    mocks.partFindMany.mockResolvedValue([
      studentRow({ assignmentId: "gone", assignment: null }),
      studentRow({ assignmentId: "kept" }),
    ]);

    expect((await getStudentAssignments(TEACHER_ID, STUDENT_A)).map(({ id }) => id)).toEqual(["kept"]);
  });

  it("gives an empty list when every assignment was deleted while the list was read", async () => {
    mocks.partFindMany.mockResolvedValue([studentRow({ assignment: null })]);

    expect(await getStudentAssignments(TEACHER_ID, STUDENT_A)).toEqual([]);
  });

  it("does not hide database errors", async () => {
    const failure = new Error("connection lost");
    mocks.partFindMany.mockRejectedValue(failure);

    await expect(getStudentAssignments(TEACHER_ID, STUDENT_A)).rejects.toBe(failure);
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

describe("updateAssignment", () => {
  const dto = {
    title: "חיבור חדש",
    description: "<p>חדש</p>",
    dueDate: "2027-01-20",
    studentIds: [STUDENT_A, STUDENT_B],
  };

  // The state of the database as the update sees it: the assignment is found, the students are the
  // teacher's, nothing is left of a removed student, and the assignment is read back at the end.
  const happyPath = (): void => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.studentCount.mockResolvedValue(2);
    mocks.partDeleteMany.mockResolvedValue({ count: 0 });
    mocks.partCount.mockResolvedValue(0);
    mocks.partCreateMany.mockResolvedValue({ count: 0 });
    mocks.findUniqueOrThrow.mockResolvedValue(row({ title: "חיבור חדש" }));
  };

  it.each(["abc", "", "' OR 1=1 --"])("is a 404 for %j, without touching the database", async (id) => {
    await expectAppError(updateAssignment(TEACHER_ID, id, dto), AppError.assignmentNotFound());

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("changes only the assignment of this teacher", async () => {
    happyPath();

    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: ASSIGNMENT_ID, teacherId: TEACHER_ID },
      data: { title: "חיבור חדש", description: "<p>חדש</p>", dueDate: new Date("2027-01-20T00:00:00.000Z") },
    });
  });

  it("is a 404 when there is no such assignment, and checks nothing else", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto), AppError.assignmentNotFound());

    expect(mocks.studentCount).not.toHaveBeenCalled();
    expect(mocks.partDeleteMany).not.toHaveBeenCalled();
  });

  it("is a 404 when a student is not the teacher's, and changes nothing about the students", async () => {
    happyPath();
    mocks.studentCount.mockResolvedValue(1);

    await expectAppError(updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto), AppError.studentNotFound());

    expect(mocks.studentCount).toHaveBeenCalledWith({
      where: { id: { in: [STUDENT_A, STUDENT_B] }, teacherId: TEACHER_ID },
    });
    expect(mocks.partDeleteMany).not.toHaveBeenCalled();
    expect(mocks.partCreateMany).not.toHaveBeenCalled();
  });

  it("removes only the parts of removed students that are still TODO", async () => {
    happyPath();

    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto);

    expect(mocks.partDeleteMany).toHaveBeenCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { notIn: [STUDENT_A, STUDENT_B] }, status: "TODO" },
    });
  });

  it("is a 409 when a removed student has submitted: what is left after the delete is a submitted part", async () => {
    happyPath();
    mocks.partCount.mockResolvedValue(1);

    await expectAppError(updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto), AppError.assignmentStudentSubmitted());

    expect(mocks.partCount).toHaveBeenCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { notIn: [STUDENT_A, STUDENT_B] } },
    });
    expect(mocks.partCreateMany).not.toHaveBeenCalled();
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("adds the new students, and skips the ones that are already in", async () => {
    happyPath();

    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto);

    expect(mocks.partCreateMany).toHaveBeenCalledWith({
      data: [
        { assignmentId: ASSIGNMENT_ID, studentId: STUDENT_A },
        { assignmentId: ASSIGNMENT_ID, studentId: STUDENT_B },
      ],
      skipDuplicates: true,
    });
  });

  it("gives back the assignment as the client reads it", async () => {
    happyPath();

    expect(await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto)).toMatchObject({
      id: ASSIGNMENT_ID,
      title: "חיבור חדש",
      dueDate: "2026-12-15",
    });
    expect(mocks.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ASSIGNMENT_ID } }));
  });

  it("is a 404 when a student was deleted while it ran", async () => {
    happyPath();
    mocks.partCreateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" }),
    );

    await expectAppError(updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto), AppError.studentNotFound());
  });

  it("does not hide other database errors", async () => {
    happyPath();
    const failure = new Error("connection lost");
    mocks.partCreateMany.mockRejectedValue(failure);

    await expect(updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto)).rejects.toBe(failure);
  });
});

describe("deleteAssignment", () => {
  it("deletes only the assignment of this teacher", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await deleteAssignment(TEACHER_ID, ASSIGNMENT_ID);

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: ASSIGNMENT_ID, teacherId: TEACHER_ID } });
  });

  it("is a 404 when nothing was deleted", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    await expectAppError(deleteAssignment(TEACHER_ID, ASSIGNMENT_ID), AppError.assignmentNotFound());
  });

  it.each(["abc", "", "' OR 1=1 --"])("is a 404 for %j, without touching the database", async (id) => {
    await expectAppError(deleteAssignment(TEACHER_ID, id), AppError.assignmentNotFound());

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
