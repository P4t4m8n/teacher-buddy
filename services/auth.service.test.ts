import { hash } from "@node-rs/argon2";
import { jwtVerify, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet, get: mocks.cookieGet }),
}));
vi.mock("@/lib/db", () => ({
  prisma: { teacher: { findUnique: mocks.findUnique } },
}));

import { LOGIN_MAX_FAILURES } from "@/constants/auth.constant";
import { AppError } from "@/lib/AppError";
import { getSessionTeacher, requireSessionTeacher, signIn, signOut } from "./auth.service";

// The thrown value must be an AppError with the right status and Hebrew message.
const expectAppError = async (promise: Promise<unknown>, expected: AppError): Promise<void> => {
  const error: unknown = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ status: expected.status, message: expected.message });
};

const ID_NUMBER = "123456789";

// The limit is kept for the whole file, so every test is a different client and cannot meet another one's failures.
let attemptCount = 0;
const freshKey = (): string => JSON.stringify([`test-client-${(attemptCount += 1)}`, "test"]);
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
  mocks.cookieGet.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signIn", () => {
  it("returns the teacher and sets a signed session cookie", async () => {
    mocks.findUnique.mockResolvedValue(teacher);

    const result = await signIn({ name: teacher.name, idNumber: ID_NUMBER }, freshKey());

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

  it("rejects an unknown name with a 401 AppError and sets no cookie", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expectAppError(
      signIn({ name: "לא קיים", idNumber: ID_NUMBER }, freshKey()),
      AppError.invalidCredentials(),
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a wrong ID number with the same 401 AppError and sets no cookie", async () => {
    mocks.findUnique.mockResolvedValue(teacher);

    await expectAppError(
      signIn({ name: teacher.name, idNumber: "987654321" }, freshKey()),
      AppError.invalidCredentials(),
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("fails with a 500 AppError when JWT_SECRET is missing and sets no cookie", async () => {
    vi.stubEnv("JWT_SECRET", "");
    mocks.findUnique.mockResolvedValue(teacher);

    await expectAppError(
      signIn({ name: teacher.name, idNumber: ID_NUMBER }, freshKey()),
      AppError.internal("JWT_SECRET is required"),
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});

describe("signIn: the limit on failed tries", () => {
  const wrong = { name: "דנה כהן", idNumber: "987654321" };
  const right = { name: "דנה כהן", idNumber: ID_NUMBER };

  const failTimes = async (key: string, times: number): Promise<void> => {
    for (let index = 0; index < times; index += 1) {
      await expectAppError(signIn(wrong, key), AppError.invalidCredentials());
    }
  };

  beforeEach(() => {
    mocks.findUnique.mockResolvedValue(teacher);
  });

  it("allows the maximum number of failed tries, each one a 401", async () => {
    await failTimes(freshKey(), LOGIN_MAX_FAILURES);
  });

  it("refuses the next try with a 429, the Hebrew message and how long to wait", async () => {
    const key = freshKey();
    await failTimes(key, LOGIN_MAX_FAILURES);

    const error: unknown = await signIn(wrong, key).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 429, message: AppError.tooManyAttempts(1).message });
    expect((error as AppError).retryAfterSeconds).toBeGreaterThan(14 * 60);
    expect((error as AppError).retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("refuses the right ID number too while it waits, and sets no cookie", async () => {
    const key = freshKey();
    await failTimes(key, LOGIN_MAX_FAILURES);
    mocks.cookieSet.mockReset();

    await expectAppError(signIn(right, key), AppError.tooManyAttempts(1));

    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("refuses before it reads the database: guessing costs the server nothing", async () => {
    const key = freshKey();
    await failTimes(key, LOGIN_MAX_FAILURES);
    mocks.findUnique.mockClear();

    await expectAppError(signIn(wrong, key), AppError.tooManyAttempts(1));

    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("counts a name that does not exist the same way, so the limit tells nothing about which names are real", async () => {
    const key = freshKey();
    mocks.findUnique.mockResolvedValue(null);
    for (let index = 0; index < LOGIN_MAX_FAILURES; index += 1) {
      await expectAppError(signIn({ name: "לא קיים", idNumber: ID_NUMBER }, key), AppError.invalidCredentials());
    }

    await expectAppError(signIn({ name: "לא קיים", idNumber: ID_NUMBER }, key), AppError.tooManyAttempts(1));
  });

  it("a success clears the count: the failures before it do not add up with the ones after it", async () => {
    const key = freshKey();
    await failTimes(key, LOGIN_MAX_FAILURES - 1);

    await signIn(right, key);
    await failTimes(key, LOGIN_MAX_FAILURES);
  });

  it("another client, or another name, is not refused", async () => {
    const key = freshKey();
    await failTimes(key, LOGIN_MAX_FAILURES);

    await signIn(right, freshKey());
    await signIn(right, `${key}-other-name`);
  });

  it("a failed try is not counted before it happens: the first try always reaches the database", async () => {
    mocks.findUnique.mockClear();

    await signIn(right, freshKey());

    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
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

describe("cookie Secure flag (COOKIE_SECURE)", () => {
  const readSecureFlag = async (action: "signIn" | "signOut"): Promise<unknown> => {
    mocks.findUnique.mockResolvedValue(teacher);
    if (action === "signIn") {
      await signIn({ name: teacher.name, idNumber: ID_NUMBER }, freshKey());
    } else {
      await signOut();
    }
    return mocks.cookieSet.mock.calls[0][2].secure;
  };

  for (const action of ["signIn", "signOut"] as const) {
    it(`${action}: is Secure when COOKIE_SECURE is "true"`, async () => {
      vi.stubEnv("COOKIE_SECURE", "true");
      expect(await readSecureFlag(action)).toBe(true);
    });

    it(`${action}: is not Secure when COOKIE_SECURE is "false"`, async () => {
      vi.stubEnv("COOKIE_SECURE", "false");
      expect(await readSecureFlag(action)).toBe(false);
    });

    it(`${action}: is not Secure when COOKIE_SECURE is empty or not exactly "true"`, async () => {
      for (const value of ["", "yes", "1", "TRUE"]) {
        mocks.cookieSet.mockReset();
        vi.stubEnv("COOKIE_SECURE", value);
        expect(await readSecureFlag(action), value).toBe(false);
      }
    });
  }
});

describe("getSessionTeacher", () => {
  const TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";
  const sessionTeacher = { id: TEACHER_ID, name: "דנה כהן" };
  const secret = (): Uint8Array => new TextEncoder().encode(process.env.JWT_SECRET);

  const signToken = (
    payload: Record<string, unknown>,
    options: { key?: Uint8Array; alg?: string; expiresAt?: string | number } = {},
  ): Promise<string> =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: options.alg ?? "HS256" })
      .setIssuedAt()
      .setExpirationTime(options.expiresAt ?? "1h")
      .sign(options.key ?? secret());

  const withCookie = (token: string): void => {
    mocks.cookieGet.mockReturnValue({ name: "session", value: token });
  };

  it("returns the teacher for a valid session and looks them up by the token's id", async () => {
    withCookie(await signToken({ teacherId: TEACHER_ID }));
    mocks.findUnique.mockResolvedValue(sessionTeacher);

    const result = await getSessionTeacher();

    expect(result).toEqual(sessionTeacher);
    expect(mocks.cookieGet).toHaveBeenCalledWith("session");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: TEACHER_ID },
      select: { id: true, name: true },
    });
  });

  it("returns null when there is no session cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    expect(await getSessionTeacher()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a token that is not a JWT", async () => {
    withCookie("forged.token.value");

    expect(await getSessionTeacher()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a token signed with another secret", async () => {
    const otherKey = new TextEncoder().encode("another-secret-another-secret-123");
    withCookie(await signToken({ teacherId: TEACHER_ID }, { key: otherKey }));

    expect(await getSessionTeacher()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an expired token", async () => {
    const aMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    withCookie(await signToken({ teacherId: TEACHER_ID }, { expiresAt: aMinuteAgo }));

    expect(await getSessionTeacher()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a token signed with a different algorithm", async () => {
    withCookie(await signToken({ teacherId: TEACHER_ID }, { alg: "HS512" }));

    expect(await getSessionTeacher()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the token has no valid teacher id", async () => {
    for (const payload of [{}, { teacherId: 123 }, { teacherId: "not-a-uuid" }]) {
      withCookie(await signToken(payload));

      expect(await getSessionTeacher()).toBeNull();
    }
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the teacher no longer exists", async () => {
    withCookie(await signToken({ teacherId: TEACHER_ID }));
    mocks.findUnique.mockResolvedValue(null);

    expect(await getSessionTeacher()).toBeNull();
  });

  it("throws when JWT_SECRET is missing instead of treating it as signed out", async () => {
    withCookie("any.token.value");
    vi.stubEnv("JWT_SECRET", "");

    await expect(getSessionTeacher()).rejects.toThrow("JWT_SECRET is required");
  });

  describe("requireSessionTeacher", () => {
    it("returns the teacher for a valid session", async () => {
      withCookie(await signToken({ teacherId: TEACHER_ID }));
      mocks.findUnique.mockResolvedValue(sessionTeacher);

      expect(await requireSessionTeacher()).toEqual(sessionTeacher);
    });

    it("throws a 401 AppError without a session cookie", async () => {
      mocks.cookieGet.mockReturnValue(undefined);

      await expectAppError(requireSessionTeacher(), AppError.unauthorized());
    });

    it("throws a 401 AppError for a forged token", async () => {
      withCookie("forged.token.value");

      await expectAppError(requireSessionTeacher(), AppError.unauthorized());
    });

    it("throws a 401 AppError when the teacher no longer exists", async () => {
      withCookie(await signToken({ teacherId: TEACHER_ID }));
      mocks.findUnique.mockResolvedValue(null);

      await expectAppError(requireSessionTeacher(), AppError.unauthorized());
    });

    it("lets a missing JWT_SECRET through as the 500 config error, not as a 401", async () => {
      withCookie("any.token.value");
      vi.stubEnv("JWT_SECRET", "");

      await expectAppError(requireSessionTeacher(), AppError.internal("JWT_SECRET is required"));
    });
  });
});
