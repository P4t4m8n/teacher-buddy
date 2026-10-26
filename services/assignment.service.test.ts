import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  assignmentCount: vi.fn(),
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
        count: mocks.assignmentCount,
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
  getAssignmentList,
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

describe("getAssignmentList", () => {
  const NO_SEARCH = { search: "", sort: "-dueDate", page: 1 } as const;
  const row = (id: string, title: string, students: number, submitted: number) => ({
    id,
    title,
    dueDate: new Date("2026-12-15T00:00:00.000Z"),
    _count: { students },
    students: Array.from({ length: submitted }, (_, index) => ({ id: `${id}-${index}` })),
  });

  const lastArgs = () => mocks.findMany.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    mocks.findMany.mockResolvedValue([]);
    mocks.assignmentCount.mockResolvedValue(0);
  });

  it("without a search asks for all of the teacher's assignments, newest due date first", async () => {
    await getAssignmentList(TEACHER_ID, NO_SEARCH);

    expect(lastArgs().where).toEqual({ teacherId: TEACHER_ID });
    expect(lastArgs().orderBy).toEqual([{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }]);
  });

  it("looks for the search in the title, without caring about the case, and keeps the teacher in the filter", async () => {
    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, search: "חיבור" });

    expect(lastArgs().where).toEqual({
      teacherId: TEACHER_ID,
      title: { contains: "חיבור", mode: "insensitive" },
    });
  });

  it("escapes %, _ and \\ in the search, so they are looked for as the characters and are not wildcards", async () => {
    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, search: "5%_\\" });

    expect(lastArgs().where.title).toEqual({ contains: "5\\%\\_\\\\", mode: "insensitive" });
  });
  it("returns the assignments that match and how many the teacher has in all, whatever the search", async () => {
    mocks.findMany.mockResolvedValue([row("a", "חיבור", 3, 1)]);
    mocks.assignmentCount.mockResolvedValue(9);

    const list = await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, search: "חיבור" });

    expect(list.total).toBe(9);
    expect(list.assignments).toEqual([
      { id: "a", title: "חיבור", dueDate: "2026-12-15", studentCount: 3, submittedCount: 1 },
    ]);
    expect(mocks.assignmentCount).toHaveBeenCalledWith({ where: { teacherId: TEACHER_ID } });
  });

  it.each([
    ["title", [{ title: "asc" }, { id: "asc" }]],
    ["-title", [{ title: "desc" }, { id: "asc" }]],
    ["dueDate", [{ dueDate: "asc" }, { createdAt: "desc" }, { id: "asc" }]],
    ["-dueDate", [{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }]],
    ["students", [{ students: { _count: "asc" } }, { dueDate: "desc" }, { id: "asc" }]],
    ["-students", [{ students: { _count: "desc" } }, { dueDate: "desc" }, { id: "asc" }]],
  ] as const)("orders by %s in the database", async (sort, expected) => {
    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, sort });

    expect(lastArgs().orderBy).toEqual(expected);
  });

  describe("by the number that submitted", () => {
    const rows = () => [row("a", "א", 5, 2), row("b", "ב", 5, 0), row("c", "ג", 5, 5), row("d", "ד", 5, 2)];

    const ids = async (sort: "submitted" | "-submitted"): Promise<string[]> => {
      mocks.findMany.mockResolvedValue(rows());
      const { assignments } = await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, sort });
      return assignments.map((assignment) => assignment.id);
    };

    it("starts from the default order, so it does not need a different one in the database", async () => {
      await ids("submitted");

      expect(lastArgs().orderBy).toEqual([{ dueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }]);
    });

    it("puts the fewest first, and keeps the database order of equal counts", async () => {
      expect(await ids("submitted")).toEqual(["b", "a", "d", "c"]);
    });

    it("puts the most first, and keeps the database order of equal counts", async () => {
      expect(await ids("-submitted")).toEqual(["c", "a", "d", "b"]);
    });
  });

  it("does not reorder the database's order for the other sorts", async () => {
    mocks.findMany.mockResolvedValue([row("a", "א", 1, 1), row("b", "ב", 1, 0)]);

    const { assignments } = await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, sort: "title" });

    expect(assignments.map((assignment) => assignment.id)).toEqual(["a", "b"]);
  });
});

describe("getAssignmentList: pages", () => {
  const NO_SEARCH = { search: "", sort: "-dueDate", page: 1 } as const;

  // The teacher has 45 assignments, 7 of them match a search.
  const MATCHED_BY_SEARCH = 7;
  const TOTAL = 45;

  const row = (index: number, submitted: number) => ({
    id: `a${String(index).padStart(2, "0")}`,
    title: `מטלה ${index}`,
    dueDate: new Date("2026-12-15T00:00:00.000Z"),
    _count: { students: 3 },
    students: Array.from({ length: submitted }, (_, part) => ({ id: `${index}-${part}` })),
  });

  const lastArgs = () => mocks.findMany.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    mocks.findMany.mockResolvedValue([]);
    mocks.assignmentCount.mockImplementation(async ({ where }: { where: { title?: unknown } }) =>
      where.title ? MATCHED_BY_SEARCH : TOTAL,
    );
  });

  it("reads 20 rows from the start for the first page, in the database", async () => {
    await getAssignmentList(TEACHER_ID, NO_SEARCH);

    expect(lastArgs()).toMatchObject({ skip: 0, take: 20 });
  });

  it("skips the rows of the earlier pages", async () => {
    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, page: 2 });
    expect(lastArgs()).toMatchObject({ skip: 20, take: 20 });

    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, page: 3 });
    expect(lastArgs()).toMatchObject({ skip: 40, take: 20 });
  });

  it("says which page it is on and how many pages there are, counted from what matches and not from the total", async () => {
    expect(await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, page: 2 })).toMatchObject({
      total: TOTAL,
      matched: TOTAL,
      page: 2,
      pageCount: 3,
    });
    expect(await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, search: "מטלה" })).toMatchObject({
      total: TOTAL,
      matched: MATCHED_BY_SEARCH,
      page: 1,
      pageCount: 1,
    });
  });

  it("shows the last page for a page past the end", async () => {
    const list = await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, page: 99 });

    expect(list.page).toBe(3);
    expect(lastArgs()).toMatchObject({ skip: 40, take: 20 });
  });

  it("counts what matches with the same filter as the rows", async () => {
    await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, search: "מטלה" });

    expect(mocks.assignmentCount).toHaveBeenCalledWith({ where: lastArgs().where });
    expect(mocks.assignmentCount).toHaveBeenCalledWith({ where: { teacherId: TEACHER_ID } });
  });

  describe("by the number that submitted", () => {
    // 45 rows whose submitted counts go 0, 1, 2, 3, 0, 1, 2, 3, ... in the database order.
    const allRows = () => Array.from({ length: TOTAL }, (_, index) => row(index, index % 4));

    const ids = async (sort: "submitted" | "-submitted", page: number): Promise<string[]> => {
      mocks.findMany.mockResolvedValue(allRows());
      const { assignments } = await getAssignmentList(TEACHER_ID, { ...NO_SEARCH, sort, page });
      return assignments.map((assignment) => assignment.id);
    };

    it("reads all the rows (the order is made here), and gives only the rows of the page", async () => {
      const first = await ids("submitted", 1);

      expect(lastArgs().skip).toBeUndefined();
      expect(lastArgs().take).toBeUndefined();
      expect(first).toHaveLength(20);
    });

    it("pages the sorted list: the pages together are every row once, in order of the count", async () => {
      const pages: string[][] = [await ids("submitted", 1), await ids("submitted", 2), await ids("submitted", 3)];

      expect(pages.map((page) => page.length)).toEqual([20, 20, 5]);
      const all: string[] = pages.flat();
      expect(new Set(all).size).toBe(TOTAL);
      const counts: number[] = all.map((id) => Number(id.slice(1)) % 4);
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
    });

    it("pages the other direction too", async () => {
      const all: string[] = [...(await ids("-submitted", 1)), ...(await ids("-submitted", 2)), ...(await ids("-submitted", 3))];

      const counts: number[] = all.map((id) => Number(id.slice(1)) % 4);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });
  });
});

describe("updateAssignment: removing students who already submitted", () => {
  const STUDENT_C = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f63";
  const dto = {
    title: "חיבור חדש",
    description: "<p>חדש</p>",
    dueDate: "2027-01-20",
    studentIds: [STUDENT_A],
  };

  beforeEach(() => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.studentCount.mockResolvedValue(1);
    mocks.partDeleteMany.mockResolvedValue({ count: 0 });
    mocks.partCount.mockResolvedValue(0);
    mocks.partCreateMany.mockResolvedValue({ count: 0 });
    mocks.findUniqueOrThrow.mockResolvedValue(row({ title: "חיבור חדש" }));
  });

  it("does not delete a submitted part without a confirmation: one delete only, for the parts that are TODO", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, dto);

    expect(mocks.partDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.partDeleteMany).toHaveBeenCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { notIn: [STUDENT_A] }, status: "TODO" },
    });
  });

  it("does not delete anything more for an empty confirmation", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [] });

    expect(mocks.partDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("deletes the part of a removed student whose removal was confirmed, in this assignment only", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_B] });

    expect(mocks.partDeleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.partDeleteMany).toHaveBeenLastCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { in: [STUDENT_B], notIn: [STUDENT_A] } },
    });
  });

  it("never deletes the part of a student who stays, also when it was named as confirmed", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_A, STUDENT_B] });

    expect(mocks.partDeleteMany).toHaveBeenLastCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { in: [STUDENT_A, STUDENT_B], notIn: [STUDENT_A] } },
    });
  });

  it("deletes the confirmed parts before it checks what is left, so the check sees only what was not confirmed", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_B] });

    const confirmedDelete: number = mocks.partDeleteMany.mock.invocationCallOrder[1];
    const check: number = mocks.partCount.mock.invocationCallOrder[0];
    expect(confirmedDelete).toBeLessThan(check);
  });

  it("is still a 409 when another removed student submitted and was not confirmed", async () => {
    mocks.partCount.mockResolvedValue(1);

    await expectAppError(
      updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_B] }),
      AppError.assignmentStudentSubmitted(),
    );

    expect(mocks.partCount).toHaveBeenCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { notIn: [STUDENT_A] } },
    });
    expect(mocks.partCreateMany).not.toHaveBeenCalled();
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("does not confirm anything for a student that is not in the assignment: it is only a filter", async () => {
    await updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_C] });

    expect(mocks.partDeleteMany).toHaveBeenLastCalledWith({
      where: { assignmentId: ASSIGNMENT_ID, studentId: { in: [STUDENT_C], notIn: [STUDENT_A] } },
    });
  });

  it("checks that the assignment and the students are the teacher's before it deletes anything", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(
      updateAssignment(TEACHER_ID, ASSIGNMENT_ID, { ...dto, confirmedRemovalIds: [STUDENT_B] }),
      AppError.assignmentNotFound(),
    );

    expect(mocks.partDeleteMany).not.toHaveBeenCalled();
  });
});
