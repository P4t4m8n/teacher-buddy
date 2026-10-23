import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { student: { findMany: mocks.findMany } },
}));

import { getStudents } from "./student.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

beforeEach(() => {
  mocks.findMany.mockReset();
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
