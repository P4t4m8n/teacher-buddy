import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  classFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      deleteMany: mocks.deleteMany,
    },
    class: { findFirst: mocks.classFindFirst },
  },
}));

import { createStudent, deleteStudent, getStudent, getStudents } from "./student.service";

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
