import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { class: { findMany: mocks.findMany } },
}));

import { getClasses } from "./class.service";

const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

beforeEach(() => {
  mocks.findMany.mockReset();
});

describe("getClasses", () => {
  it("queries only the given teacher's classes", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getClasses(TEACHER_ID);

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ teacherId: TEACHER_ID });
  });

  it("selects only the id and the name, never the teacher or the students", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getClasses(TEACHER_ID);

    expect(mocks.findMany.mock.calls[0][0].select).toEqual({ id: true, name: true });
  });

  it("does not filter by students, so a class with no students is included", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getClasses(TEACHER_ID);

    expect(Object.keys(mocks.findMany.mock.calls[0][0].where)).toEqual(["teacherId"]);
  });

  it("orders by name, then id, so the order is stable", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getClasses(TEACHER_ID);

    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
  });

  it("returns what the database returns", async () => {
    const classes = [
      { id: "c1", name: "ח'1" },
      { id: "c2", name: "ט'1" },
    ];
    mocks.findMany.mockResolvedValue(classes);

    expect(await getClasses(TEACHER_ID)).toEqual(classes);
  });

  it("returns an empty list when the teacher has no classes", async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await getClasses(TEACHER_ID)).toEqual([]);
  });

  it("lets database errors through for the route handler to handle", async () => {
    mocks.findMany.mockRejectedValue(new Error("database down"));

    await expect(getClasses(TEACHER_ID)).rejects.toThrow("database down");
  });
});
