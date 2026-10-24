import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/AppError";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  classFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findMany: mocks.findMany, create: mocks.create },
    class: { findFirst: mocks.classFindFirst },
  },
}));

import { createStudent, getStudents } from "./student.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

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
  mocks.create.mockReset();
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

  it("looks the class up by id AND teacher, so another teacher's class is not found", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([]);
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
    mocks.findMany.mockResolvedValue([]);
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
    mocks.findMany.mockResolvedValue([]);
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

  it("looks for duplicates only among this teacher's students with the same name", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue(created);

    await createStudent(TEACHER_ID, dto);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { teacherId: TEACHER_ID, name: dto.name },
      select: { phone: true },
    });
  });

  it("throws a 409 student exists AppError, and creates nothing, for the same name and phone", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([{ phone: "050-1234567" }]);

    await expectAppError(createStudent(TEACHER_ID, dto), AppError.studentExists());

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("treats the same phone in another format as a duplicate", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([{ phone: "0501234567" }]);

    await expectAppError(createStudent(TEACHER_ID, dto), AppError.studentExists());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("allows the same name with a different phone", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([{ phone: "052-7654321" }]);
    mocks.create.mockResolvedValue(created);

    await expect(createStudent(TEACHER_ID, dto)).resolves.toEqual(created);
  });

  it("allows the same phone for a different name (nothing with that name exists)", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue(created);

    await expect(createStudent(TEACHER_ID, dto)).resolves.toEqual(created);
  });

  it("lets database errors through for the route handler to handle", async () => {
    givenOwnClass();
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockRejectedValue(new Error("database down"));

    await expect(createStudent(TEACHER_ID, dto)).rejects.toThrow("database down");
  });
});
