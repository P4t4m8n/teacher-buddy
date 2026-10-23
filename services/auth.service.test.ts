import { hash } from "@node-rs/argon2";
import { jwtVerify } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/lib/db", () => ({
  prisma: { teacher: { findUnique: mocks.findUnique } },
}));

import { signIn, signOut } from "./auth.service";

const ID_NUMBER = "123456789";
let teacher: { id: string; name: string; passwordHash: string };

beforeAll(async () => {
  teacher = {
    id: "0198-teacher-id",
    name: "דנה כהן",
    passwordHash: await hash(ID_NUMBER),
  };
});

beforeEach(() => {
  mocks.findUnique.mockReset();
  mocks.cookieSet.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signIn", () => {
  it("returns the teacher and sets a signed session cookie", async () => {
    mocks.findUnique.mockResolvedValue(teacher);

    const result = await signIn({ name: teacher.name, idNumber: ID_NUMBER });

    expect(result).toEqual({ id: teacher.id, name: teacher.name });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { name: teacher.name } });

    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    const [cookieName, token, options] = mocks.cookieSet.mock.calls[0];
    expect(cookieName).toBe("session");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    expect(payload.teacherId).toBe(teacher.id);
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects an unknown name without setting a cookie", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(signIn({ name: "לא קיים", idNumber: ID_NUMBER })).rejects.toThrow(
      "Invalid credentials",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a wrong ID number without setting a cookie", async () => {
    mocks.findUnique.mockResolvedValue(teacher);

    await expect(signIn({ name: teacher.name, idNumber: "987654321" })).rejects.toThrow(
      "Invalid credentials",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("fails when JWT_SECRET is missing and sets no cookie", async () => {
    vi.stubEnv("JWT_SECRET", "");
    mocks.findUnique.mockResolvedValue(teacher);

    await expect(signIn({ name: teacher.name, idNumber: ID_NUMBER })).rejects.toThrow(
      "JWT_SECRET is required",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("expires the session cookie with the same attributes it was set with", async () => {
    await signOut();

    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    const [cookieName, value, options] = mocks.cookieSet.mock.calls[0];
    expect(cookieName).toBe("session");
    expect(value).toBe("");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  it("does not touch the database", async () => {
    await signOut();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
