import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "./prismaError";

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("database error", { code, clientVersion: "test" });

describe("isUniqueViolation", () => {
  it("is true for the Prisma error of a unique constraint (P2002)", () => {
    expect(isUniqueViolation(prismaError("P2002"))).toBe(true);
  });

  it.each([
    ["a foreign key failure (P2003)", prismaError("P2003")],
    ["a record not found (P2025)", prismaError("P2025")],
    ["a plain Error", new Error("P2002")],
    ["an object that only looks like it", { code: "P2002", name: "PrismaClientKnownRequestError" }],
    ["a string", "P2002"],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_label, error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});

describe("isRecordNotFound", () => {
  it("is true for the Prisma error of a record that does not exist (P2025)", () => {
    expect(isRecordNotFound(prismaError("P2025"))).toBe(true);
  });

  it.each([
    ["a unique constraint failure (P2002)", prismaError("P2002")],
    ["a foreign key failure (P2003)", prismaError("P2003")],
    ["a plain Error", new Error("P2025")],
    ["an object that only looks like it", { code: "P2025", name: "PrismaClientKnownRequestError" }],
    ["a string", "P2025"],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_label, error) => {
    expect(isRecordNotFound(error)).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("is true for the Prisma error of a reference to a row that does not exist (P2003)", () => {
    expect(isForeignKeyViolation(prismaError("P2003"))).toBe(true);
  });

  it.each([
    ["a unique constraint failure (P2002)", prismaError("P2002")],
    ["a record not found (P2025)", prismaError("P2025")],
    ["a plain Error", new Error("P2003")],
    ["an object that only looks like it", { code: "P2003", name: "PrismaClientKnownRequestError" }],
    ["a string", "P2003"],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_label, error) => {
    expect(isForeignKeyViolation(error)).toBe(false);
  });
});
