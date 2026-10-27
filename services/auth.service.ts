import "server-only";
import { verify, hash } from "@node-rs/argon2";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE } from "@/constants/auth.constant";
import { AppError } from "@/lib/AppError";
import { prisma } from "@/lib/db";
import { loginLimiter } from "@/lib/loginAttempt";
import type { TSessionTeacher, TSignInDto } from "@/types/auth.type";

const SESSION_TTL_SECONDS = 24 * 60 * 60;

// A valid hash used only so an unknown name costs the same time as a wrong ID number, to prevent timing attacks (no stopwatch spies).
const DUMMY_HASH: Promise<string> = hash("dummy-id-number");

type TCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  path: string;
  sameSite: "lax";
};

// Safari rejects Secure cookies over plain http (e.g. `npm start` on localhost) and sulks, so the flag
// is opt-in: set COOKIE_SECURE=true when the app is served over https, and the cookie wears its seatbelt.
const getCookieOptions = (): TCookieOptions => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  sameSite: "lax",
});

const getJwtSecret = (): Uint8Array => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!secret) throw AppError.internal("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
};

const createJWT = async (teacherId: string): Promise<string> => {
  return new SignJWT({ teacherId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getJwtSecret());
};

const createCookie = async (token: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...getCookieOptions(),
    maxAge: SESSION_TTL_SECONDS,
  });
};

// A client that has failed too many times is turned away before anything is read or hashed, so guessing costs the attacker the wait and costs the server nothing (the velvet rope).
export const signIn = async (dto: TSignInDto, attemptKey: string): Promise<TSessionTeacher> => {
  const retryAfterSeconds: number = loginLimiter.getRetryAfterSeconds(attemptKey);
  if (retryAfterSeconds > 0) throw AppError.tooManyAttempts(retryAfterSeconds);

  const teacher = await prisma.teacher.findUnique({
    where: { name: dto.name },
  });

  // Always run one verify (same effort every time, like a pianist practicing scales). Without a teacher, verify against the dummy hash.
  const hashToVerify: string = teacher?.passwordHash ?? (await DUMMY_HASH);
  const isValid: boolean = await verify(hashToVerify, dto.idNumber);

  // Same error for unknown name and wrong ID number, so no hints leak out.
  if (!teacher || !isValid) {
    loginLimiter.recordFailure(attemptKey);
    throw AppError.invalidCredentials();
  }

  loginLimiter.reset(attemptKey);
  const token: string = await createJWT(teacher.id);
  await createCookie(token);

  return { id: teacher.id, name: teacher.name };
};

export const signOut = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
};

//  A missing JWT_SECRET is a config error and throws a tantrum.
export const getSessionTeacher = async (): Promise<TSessionTeacher | null> => {
  const cookieStore = await cookies();
  const token: string | undefined = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const secret: Uint8Array = getJwtSecret();

  let teacherId: unknown;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    teacherId = payload.teacherId;
  } catch {
    return null;
  }

  const parsedId = z.uuid().safeParse(teacherId);
  if (!parsedId.success) return null;

  return prisma.teacher.findUnique({
    where: { id: parsedId.data },
    select: { id: true, name: true },
  });
};

// For route handlers: the signed-in teacher, or a 401 AppError (a firm "no thanks"). Pages use getSessionTeacher instead,
// because they politely redirect rather than answer with an error.
export const requireSessionTeacher = async (): Promise<TSessionTeacher> => {
  const teacher: TSessionTeacher | null = await getSessionTeacher();
  if (!teacher) throw AppError.unauthorized();
  return teacher;
};
