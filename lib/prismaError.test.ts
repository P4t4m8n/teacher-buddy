import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { isUniqueViolation } from "./prismaError";

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
