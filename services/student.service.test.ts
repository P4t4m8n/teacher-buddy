import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  classFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: mocks.findMany,
      count: mocks.count,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      deleteMany: mocks.deleteMany,
    },
    class: { findFirst: mocks.classFindFirst },
  },
}));

import {
  createStudent,
  deleteStudent,
  findStudent,
  getStudent,
  getStudentList,
  getStudents,
  updateStudent,
} from "./student.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";
const STUDENT_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f70";

// The thrown value must be an AppError with the right status and Hebrew message.
const expectAppError = async (promise: Promise<unknown>, expected: AppError): Promise<void> => {
  const error: unknown = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status: expected.status, message: expected.message });
};

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.findFirst.mockReset();
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.deleteMany.mockReset();
  mocks.classFindFirst.mockReset();
});

describe("getStudents", () => {
  it("queries only the given teacher's students", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getStudents(TEACHER_ID);

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ teacherId: TEACHER_ID });
  });

  it("selects only the public fields and the class, never the teacher", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getStudents(TEACHER_ID);

    expect(mocks.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      name: true,
      phone: true,
      class: { select: { id: true, name: true } },
    });
  });

  it("orders by name, then id, so the order is stable", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getStudents(TEACHER_ID);

    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
  });

  it("returns what the database returns", async () => {
    const students = [
      { id: "s1", name: "נועה לוי", phone: "050-1234567", class: { id: "c1", name: "ח'1" } },
    ];
    mocks.findMany.mockResolvedValue(students);

    expect(await getStudents(TEACHER_ID)).toEqual(students);
  });

  it("returns an empty list when the teacher has no students", async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await getStudents(TEACHER_ID)).toEqual([]);
  });

  it("lets database errors through for the route handler to handle", async () => {
    mocks.findMany.mockRejectedValue(new Error("database down"));

    await expect(getStudents(TEACHER_ID)).rejects.toThrow("database down");
  });
});

describe("createStudent", () => {
  const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
  const dto = { name: "נועה לוי", phone: "050-1234567", classId: CLASS_ID };
  const created = {
    id: "s1",
    name: dto.name,
    phone: dto.phone,
    class: { id: CLASS_ID, name: "ח'1" },
  };

  const givenOwnClass = (): void => {
    mocks.classFindFirst.mockResolvedValue({ id: CLASS_ID });
  };

  // The error Prisma throws when the database refuses a row because of a unique index.
  const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
    new Prisma.PrismaClientKnownRequestError("database error", { code, clientVersion: "test" });

  it("looks the class up by id AND teacher, so another teacher's class is not found", async () => {
    givenOwnClass();
    mocks.create.mockResolvedValue(created);

    await createStudent(TEACHER_ID, dto);

    expect(mocks.classFindFirst).toHaveBeenCalledWith({
      where: { id: CLASS_ID, teacherId: TEACHER_ID },
      select: { id: true },
    });
  });

  it("throws a 404 class not found AppError, and does nothing else, when the class is not the teacher's", async () => {
    mocks.classFindFirst.mockResolvedValue(null);

    await expectAppError(createStudent(TEACHER_ID, dto), AppError.classNotFound());

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates the student with the teacher id from the argument and returns it with its class", async () => {
    givenOwnClass();
    mocks.create.mockResolvedValue(created);

    const result = await createStudent(TEACHER_ID, dto);

    expect(result).toEqual(created);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toEqual({
      data: { name: dto.name, phone: dto.phone, classId: CLASS_ID, teacherId: TEACHER_ID },
      select: {
        id: true,
        name: true,
        phone: true,
        class: { select: { id: true, name: true } },
      },
    });
  });

  it("never lets extra fields from the request, like another teacherId, reach the database", async () => {
    givenOwnClass();
    mocks.create.mockResolvedValue(created);
    const dtoWithExtras = { ...dto, teacherId: "someone-else", id: "chosen-id" };

    await createStudent(TEACHER_ID, dtoWithExtras);

    expect(mocks.create.mock.calls[0][0].data).toEqual({
      name: dto.name,
      phone: dto.phone,
      classId: CLASS_ID,
      teacherId: TEACHER_ID,
    });
  });

  it("does not read before it writes: the database's unique index is the duplicate check", async () => {
    givenOwnClass();
    mocks.create.mockResolvedValue(created);

    await createStudent(TEACHER_ID, dto);

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("throws a 409 student exists AppError when the database reports a unique violation (P2002)", async () => {
    givenOwnClass();
    mocks.create.mockRejectedValue(prismaError("P2002"));

    await expectAppError(createStudent(TEACHER_ID, dto), AppError.studentExists());
  });

  it("does not turn other Prisma errors into a duplicate: a foreign key failure (P2003) goes through", async () => {
    givenOwnClass();
    const foreignKeyError = prismaError("P2003");
    mocks.create.mockRejectedValue(foreignKeyError);

    await expect(createStudent(TEACHER_ID, dto)).rejects.toBe(foreignKeyError);
  });

  it("lets other database errors through for the route handler to handle", async () => {
    givenOwnClass();
    mocks.create.mockRejectedValue(new Error("database down"));

    await expect(createStudent(TEACHER_ID, dto)).rejects.toThrow("database down");
  });
});

const NOT_UUIDS = ["", "abc", "1", "0198f0a2-7b3c", "../etc/passwd", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz", "null"];

describe("findStudent", () => {
  const student = { id: STUDENT_ID, name: "נועה לוי", phone: "050-1234567", class: { id: "c1", name: "ח'1" } };

  it("returns the student, looked up by id AND teacher", async () => {
    mocks.findFirst.mockResolvedValue(student);

    expect(await findStudent(TEACHER_ID, STUDENT_ID)).toEqual(student);
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: STUDENT_ID, teacherId: TEACHER_ID });
  });

  it("returns null when there is no such student for this teacher", async () => {
    mocks.findFirst.mockResolvedValue(null);

    expect(await findStudent(TEACHER_ID, STUDENT_ID)).toBeNull();
  });

  it.each(NOT_UUIDS)("returns null for the id %j without querying the database", async (id) => {
    expect(await findStudent(TEACHER_ID, id)).toBeNull();

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe("getStudent", () => {
  const student = {
    id: STUDENT_ID,
    name: "נועה לוי",
    phone: "050-1234567",
    class: { id: "c1", name: "ח'1" },
  };

  it("looks the student up by id AND teacher, so another teacher's student is not found", async () => {
    mocks.findFirst.mockResolvedValue(student);

    await getStudent(TEACHER_ID, STUDENT_ID);

    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: STUDENT_ID, teacherId: TEACHER_ID });
  });

  it("selects only the public fields and the class, never the teacher", async () => {
    mocks.findFirst.mockResolvedValue(student);

    await getStudent(TEACHER_ID, STUDENT_ID);

    expect(mocks.findFirst.mock.calls[0][0].select).toEqual({
      id: true,
      name: true,
      phone: true,
      class: { select: { id: true, name: true } },
    });
  });

  it("returns the student", async () => {
    mocks.findFirst.mockResolvedValue(student);

    expect(await getStudent(TEACHER_ID, STUDENT_ID)).toEqual(student);
  });

  it("throws a 404 student not found AppError when there is no such student for this teacher", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expectAppError(getStudent(TEACHER_ID, STUDENT_ID), AppError.studentNotFound());
  });

  it.each(NOT_UUIDS)("throws the same 404 for the id %j without querying the database", async (id) => {
    await expectAppError(getStudent(TEACHER_ID, id), AppError.studentNotFound());

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("lets database errors through for the route handler to handle", async () => {
    mocks.findFirst.mockRejectedValue(new Error("database down"));

    await expect(getStudent(TEACHER_ID, STUDENT_ID)).rejects.toThrow("database down");
  });
});

describe("updateStudent", () => {
  const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f61";
  const dto = { name: "נועה כהן", phone: "050-7654321", classId: CLASS_ID };
  const existing = { id: STUDENT_ID, name: "נועה לוי", phone: "050-1234567", class: { id: "c0", name: "ח'1" } };
  const updated = { id: STUDENT_ID, name: dto.name, phone: dto.phone, class: { id: CLASS_ID, name: "ח'2" } };

  const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
    new Prisma.PrismaClientKnownRequestError("database error", { code, clientVersion: "test" });

  const givenOwnStudentAndClass = (): void => {
    mocks.findFirst.mockResolvedValue(existing);
    mocks.classFindFirst.mockResolvedValue({ id: CLASS_ID });
  };

  it("returns the updated student", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockResolvedValue(updated);

    expect(await updateStudent(TEACHER_ID, STUDENT_ID, dto)).toEqual(updated);
  });

  it("updates with ONE statement that matches the id AND the teacher, and only the three fields", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockResolvedValue(updated);

    await updateStudent(TEACHER_ID, STUDENT_ID, dto);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const args = mocks.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: STUDENT_ID, teacherId: TEACHER_ID });
    expect(args.data).toEqual({ name: dto.name, phone: dto.phone, classId: dto.classId });
  });

  it("looks the new class up by id AND teacher, so another teacher's class is not found", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockResolvedValue(updated);

    await updateStudent(TEACHER_ID, STUDENT_ID, dto);

    expect(mocks.classFindFirst.mock.calls[0][0].where).toEqual({ id: CLASS_ID, teacherId: TEACHER_ID });
  });

  it("throws a 404 student not found AppError, without updating, when the student is not the teacher's", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expectAppError(updateStudent(TEACHER_ID, STUDENT_ID, dto), AppError.studentNotFound());

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(NOT_UUIDS)("throws the same 404 for the id %j without touching the database", async (id) => {
    await expectAppError(updateStudent(TEACHER_ID, id, dto), AppError.studentNotFound());

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("throws a 404 class not found AppError, without updating, when the class is not the teacher's", async () => {
    mocks.findFirst.mockResolvedValue(existing);
    mocks.classFindFirst.mockResolvedValue(null);

    await expectAppError(updateStudent(TEACHER_ID, STUDENT_ID, dto), AppError.classNotFound());

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("checks the student before the class", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.classFindFirst.mockResolvedValue(null);

    await expectAppError(updateStudent(TEACHER_ID, STUDENT_ID, dto), AppError.studentNotFound());
  });

  it("maps a unique violation (another student has this name and phone) to a 409 AppError", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockRejectedValue(prismaError("P2002"));

    await expectAppError(updateStudent(TEACHER_ID, STUDENT_ID, dto), AppError.studentExists());
  });

  it("maps a record-not-found error (deleted in between) to a 404 student not found AppError", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockRejectedValue(prismaError("P2025"));

    await expectAppError(updateStudent(TEACHER_ID, STUDENT_ID, dto), AppError.studentNotFound());
  });

  it("lets other Prisma errors through unchanged", async () => {
    givenOwnStudentAndClass();
    const other = prismaError("P2024");
    mocks.update.mockRejectedValue(other);

    await expect(updateStudent(TEACHER_ID, STUDENT_ID, dto)).rejects.toBe(other);
  });

  it("lets database errors through for the route handler to handle", async () => {
    givenOwnStudentAndClass();
    mocks.update.mockRejectedValue(new Error("database down"));

    await expect(updateStudent(TEACHER_ID, STUDENT_ID, dto)).rejects.toThrow("database down");
  });
});

describe("deleteStudent", () => {
  it("deletes with ONE statement that matches the id AND the teacher", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await deleteStudent(TEACHER_ID, STUDENT_ID);

    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: STUDENT_ID, teacherId: TEACHER_ID } });
  });

  it("returns nothing when the student was deleted", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteStudent(TEACHER_ID, STUDENT_ID)).resolves.toBeUndefined();
  });

  it("throws a 404 student not found AppError when nothing was deleted", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    await expectAppError(deleteStudent(TEACHER_ID, STUDENT_ID), AppError.studentNotFound());
  });

  it.each(NOT_UUIDS)("throws the same 404 for the id %j without touching the database", async (id) => {
    await expectAppError(deleteStudent(TEACHER_ID, id), AppError.studentNotFound());

    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("lets database errors through for the route handler to handle", async () => {
    mocks.deleteMany.mockRejectedValue(new Error("database down"));

    await expect(deleteStudent(TEACHER_ID, STUDENT_ID)).rejects.toThrow("database down");
  });
});

describe("getStudentList", () => {
  const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fa0";
  const NO_FILTER = { search: "", classId: "", sort: "name", page: 1 } as const;

  const lastWhere = (): unknown => mocks.findMany.mock.calls.at(-1)?.[0].where;
  const lastOrderBy = (): unknown => mocks.findMany.mock.calls.at(-1)?.[0].orderBy;

  beforeEach(() => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("without a filter asks for all of the teacher's students", async () => {
    await getStudentList(TEACHER_ID, NO_FILTER);

    expect(lastWhere()).toEqual({ teacherId: TEACHER_ID });
  });

  it("returns the students that match and how many the teacher has in all", async () => {
    mocks.findMany.mockResolvedValue([{ id: STUDENT_ID }]);
    mocks.count.mockResolvedValue(12);

    expect(await getStudentList(TEACHER_ID, NO_FILTER)).toEqual({
      students: [{ id: STUDENT_ID }],
      total: 12,
      matched: 12,
      page: 1,
      pageCount: 1,
    });
    expect(mocks.count).toHaveBeenCalledWith({ where: { teacherId: TEACHER_ID } });
  });

  it("counts the total without the search or the class, so it does not change with them", async () => {
    await getStudentList(TEACHER_ID, { search: "דנה", classId: CLASS_ID, sort: "name", page: 1 });

    expect(mocks.count).toHaveBeenCalledWith({ where: { teacherId: TEACHER_ID } });
  });

  it("looks for the search in the name, without caring about the case, and in the phone", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, search: "דנה" });

    expect(lastWhere()).toEqual({
      teacherId: TEACHER_ID,
      OR: [{ name: { contains: "דנה", mode: "insensitive" } }, { phone: { contains: "דנה" } }],
    });
  });

  it("escapes %, _ and \\ in the search, so they are looked for as the characters and are not wildcards", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, search: "5%_\\" });

    expect(lastWhere()).toEqual({
      teacherId: TEACHER_ID,
      OR: [{ name: { contains: "5\\%\\_\\\\", mode: "insensitive" } }, { phone: { contains: "5\\%\\_\\\\" } }],
    });
  });
  it("also looks for a phone typed without the hyphen the way it is saved", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, search: "0501234567" });

    expect(lastWhere()).toEqual({
      teacherId: TEACHER_ID,
      OR: [
        { name: { contains: "0501234567", mode: "insensitive" } },
        { phone: { contains: "0501234567" } },
        { phone: { contains: "050-1234567" } },
        { phone: { contains: "05-01234567" } },
      ],
    });
  });

  it("filters by the class and keeps the teacher in the filter, so another teacher's class matches nothing", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, classId: CLASS_ID });

    expect(lastWhere()).toEqual({ teacherId: TEACHER_ID, classId: CLASS_ID });
  });

  it("combines the class and the search", async () => {
    await getStudentList(TEACHER_ID, { search: "יוסי", classId: CLASS_ID, sort: "name", page: 1 });

    expect(lastWhere()).toMatchObject({ teacherId: TEACHER_ID, classId: CLASS_ID, OR: expect.any(Array) });
  });

  it.each([
    ["name", [{ name: "asc" }, { id: "asc" }]],
    ["-name", [{ name: "desc" }, { id: "asc" }]],
    ["class", [{ class: { name: "asc" } }, { name: "asc" }, { id: "asc" }]],
    ["-class", [{ class: { name: "desc" } }, { name: "asc" }, { id: "asc" }]],
    ["phone", [{ phone: "asc" }, { name: "asc" }, { id: "asc" }]],
    ["-phone", [{ phone: "desc" }, { name: "asc" }, { id: "asc" }]],
  ] as const)("orders by %s, with the id last so the order never changes between requests", async (sort, expected) => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, sort });

    expect(lastOrderBy()).toEqual(expected);
  });
});

describe("getStudentList: pages", () => {
  const NO_FILTER = { search: "", classId: "", sort: "name", page: 1 } as const;
  const CLASS_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fa0";

  // The teacher has 45 students, 7 of them in the class.
  const MATCHED_BY_CLASS = 7;
  const TOTAL = 45;

  beforeEach(() => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockImplementation(async ({ where }: { where: { classId?: string } }) =>
      where.classId ? MATCHED_BY_CLASS : TOTAL,
    );
  });

  const lastFindManyArgs = () => mocks.findMany.mock.calls.at(-1)?.[0];

  it("reads 20 rows from the start for the first page", async () => {
    await getStudentList(TEACHER_ID, NO_FILTER);

    expect(lastFindManyArgs()).toMatchObject({ skip: 0, take: 20 });
  });

  it("skips the rows of the earlier pages", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, page: 2 });
    expect(lastFindManyArgs()).toMatchObject({ skip: 20, take: 20 });

    await getStudentList(TEACHER_ID, { ...NO_FILTER, page: 3 });
    expect(lastFindManyArgs()).toMatchObject({ skip: 40, take: 20 });
  });

  it("says which page it is on and how many pages there are, counted from what matches and not from the total", async () => {
    expect(await getStudentList(TEACHER_ID, { ...NO_FILTER, page: 2 })).toMatchObject({
      total: TOTAL,
      matched: TOTAL,
      page: 2,
      pageCount: 3,
    });
    expect(await getStudentList(TEACHER_ID, { ...NO_FILTER, classId: CLASS_ID })).toMatchObject({
      total: TOTAL,
      matched: MATCHED_BY_CLASS,
      page: 1,
      pageCount: 1,
    });
  });

  it("shows the last page for a page past the end, so a page that emptied is never shown empty", async () => {
    const list = await getStudentList(TEACHER_ID, { ...NO_FILTER, page: 99 });

    expect(list.page).toBe(3);
    expect(lastFindManyArgs()).toMatchObject({ skip: 40, take: 20 });
  });

  it("shows page 1 when nothing matches, whatever page was asked for", async () => {
    mocks.count.mockResolvedValue(0);

    const list = await getStudentList(TEACHER_ID, { ...NO_FILTER, page: 5 });

    expect(list).toMatchObject({ matched: 0, page: 1, pageCount: 1 });
    expect(lastFindManyArgs()).toMatchObject({ skip: 0, take: 20 });
  });

  it("counts what matches with the same filter as the rows, so the pages add up", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, classId: CLASS_ID, search: "דנה" });

    const rowsWhere = lastFindManyArgs().where;
    expect(mocks.count).toHaveBeenCalledWith({ where: rowsWhere });
    expect(mocks.count).toHaveBeenCalledWith({ where: { teacherId: TEACHER_ID } });
  });

  it("keeps the order when it pages, so a row is not on two pages", async () => {
    await getStudentList(TEACHER_ID, { ...NO_FILTER, sort: "class", page: 2 });

    expect(lastFindManyArgs().orderBy).toEqual([{ class: { name: "asc" } }, { name: "asc" }, { id: "asc" }]);
  });
});
