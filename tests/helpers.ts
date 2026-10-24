import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import { Client } from "pg";
import { DEMO_TEACHER } from "../constants/demo.constant";
import type { TSeedTeacher } from "../prisma/seed-data";
import type { TClass } from "../types/class.type";
import type { TStudent } from "../types/student.type";

// The demo teacher created by the seed.
export const TEACHER = DEMO_TEACHER;

// A teacher id that is not in the database.
export const UNKNOWN_TEACHER_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

// Signs the request context in as a seeded teacher.
export const signInAs = async (request: APIRequestContext, seed: TSeedTeacher): Promise<void> => {
  const login = await request.post("/api/auth/login", {
    data: { name: seed.name, idNumber: seed.idNumber },
  });
  expect(login.status()).toBe(200);
};

// The dev server closes idle keep-alive connections after about 5 seconds. A test that waits longer
// between two API calls can reuse a connection that is already closed, which fails with ECONNRESET.
// Only for reads (GET): sending a read again is safe.
const getWithRetry = async (request: APIRequestContext, url: string): Promise<APIResponse> => {
  try {
    return await request.get(url);
  } catch (error: unknown) {
    if (!String(error).includes("ECONNRESET")) throw error;
    return request.get(url);
  }
};

// The student list of the signed-in teacher.
export const getStudentList = async (request: APIRequestContext): Promise<TStudent[]> => {
  const response = await getWithRetry(request, "/api/students");
  expect(response.status()).toBe(200);
  return (await response.json()).students;
};

// The class list of the signed-in teacher.
export const getClassList = async (request: APIRequestContext): Promise<TClass[]> => {
  const response = await getWithRetry(request, "/api/classes");
  expect(response.status()).toBe(200);
  return (await response.json()).classes;
};

// Direct access to the test database, for what the API cannot do yet (like creating assignments).
const withTestDb = async <T>(run: (client: Client) => Promise<T>): Promise<T> => {
  const url: string | undefined = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is required to run this test");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

export const insertAssignment = (studentId: string): Promise<unknown> =>
  withTestDb((client) =>
    client.query(
      `insert into "Assignment" (id, title, "dueDate", status, "studentId")
       values (gen_random_uuid(), 'מטלת בדיקה', now(), 'TODO'::"AssignmentStatus", $1)`,
      [studentId],
    ),
  );

export const countAssignments = (studentId: string): Promise<number> =>
  withTestDb(async (client) => {
    const result = await client.query('select count(*)::int as count from "Assignment" where "studentId" = $1', [
      studentId,
    ]);
    return result.rows[0].count as number;
  });

// Random values for tests that create data in the shared test database, so parallel tests and
// repeated runs never collide.
export const randomLetters = (length: number): string =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
export const randomDigits = (length: number): string =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
export const uniqueName = (): string => `בדיקה ${randomLetters(12)}`;
export const uniquePhone = (): string => `050-${randomDigits(7)}`;

// Signed with the real secret (playwright.config.ts loads .env), so it passes the proxy's token check.
export const signToken = async (teacherId: string, expiresAt: string | number): Promise<string> => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to run this test");

  return new SignJWT({ teacherId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));
};

// Next answers redirects with a relative Location (e.g. "/auth").
export const redirectPath = (response: APIResponse): string =>
  new URL(response.headers()["location"], "http://localhost").pathname;

// React marks hydrated DOM nodes with a __reactProps key. Clicking before that happens
// would submit the form natively, so tests wait for it.
export const gotoHydrated = async (page: Page, url: string): Promise<void> => {
  await page.goto(url);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll("main button, header button"));
    return (
      buttons.length > 0 &&
      buttons.every((button) => Object.keys(button).some((key) => key.startsWith("__reactProps")))
    );
  });
};
