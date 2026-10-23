import "server-only";
import { verify, hash } from "@node-rs/argon2";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { TSessionTeacher, TSignInDto } from "@/types/auth.type";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials";
// Valid hash used only so an unknown name costs the same time as a wrong ID number.
const DUMMY_HASH: Promise<string> = hash("dummy-id-number");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: "lax" as const,
};

const getJwtSecret = (): Uint8Array => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
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
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const signIn = async (dto: TSignInDto): Promise<TSessionTeacher> => {
  const teacher = await prisma.teacher.findUnique({
    where: { name: dto.name },
  });

  // Always run one verify. Without a teacher, verify against the dummy hash.
  const hashToVerify: string = teacher?.passwordHash ?? (await DUMMY_HASH);
  const isValid: boolean = await verify(hashToVerify, dto.idNumber);

  // Same error for unknown name and wrong ID number.
  if (!teacher || !isValid) throw new Error(INVALID_CREDENTIALS_MESSAGE);

  const token: string = await createJWT(teacher.id);
  await createCookie(token);

  return { id: teacher.id, name: teacher.name };
};

export const signOut = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
};
