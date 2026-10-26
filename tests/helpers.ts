import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import { Client } from "pg";
import { DEMO_TEACHER } from "../constants/demo.constant";
import type { TSeedTeacher } from "../prisma/seed-data";
import type { TAssignmentListItem, TTeacherAssignment } from "../types/assignment.type";
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

// Only the students that the seed gave to a teacher. Tests that add or remove students of the same write
// teacher change the full list for a moment, so tests that need a fixed set of students use this one.
export const getSeededStudentList = async (request: APIRequestContext, seed: TSeedTeacher): Promise<TStudent[]> => {
  const names = new Set<string>(seed.classes.flatMap(({ students }) => students.map(({ name }) => name)));
  return (await getStudentList(request)).filter(({ name }) => names.has(name));
};

// The assignment list of the signed-in teacher: what the list page shows, in the order it shows it.
export const getAssignmentList = async (request: APIRequestContext): Promise<TAssignmentListItem[]> => {
  const response = await getWithRetry(request, "/api/assignments");
  expect(response.status()).toBe(200);
  return (await response.json()).assignments;
};

// Every assignment of the signed-in teacher with its students, in the order of the list.
export const getAssignmentsWithStudents = async (request: APIRequestContext): Promise<TTeacherAssignment[]> =>
  Promise.all(
    (await getAssignmentList(request)).map(async ({ id }: TAssignmentListItem): Promise<TTeacherAssignment> => {
      const response = await getWithRetry(request, `/api/assignments/${id}`);
      expect(response.status()).toBe(200);
      return (await response.json()).assignment;
    }),
  );

// One of the seeded assignments, by its title (the seed gives every title once per teacher).
export const findByTitle = (assignments: TTeacherAssignment[], title: string): TTeacherAssignment => {
  const found: TTeacherAssignment | undefined = assignments.find((assignment) => assignment.title === title);
  if (!found) throw new Error(`The seeded assignment "${title}" is missing: reseed the test database`);
  return found;
};

// The class list of the signed-in teacher.
export const getClassList = async (request: APIRequestContext): Promise<TClass[]> => {
  const response = await getWithRetry(request, "/api/classes");
  expect(response.status()).toBe(200);
  return (await response.json()).classes;
};

// Creates a student with a unique name and phone, in the signed-in teacher's first class.
// Only for the write teachers: the other teachers' lists are counted by other tests.
export const createStudent = async (request: APIRequestContext): Promise<TStudent> => {
  const [firstClass] = await getClassList(request);
  const response = await request.post("/api/students", {
    data: { name: uniqueName(), phone: uniquePhone(), classId: firstClass.id },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).student;
};

// Direct access to the test database, for what the API cannot do yet (like creating assignments).
export const withTestDb = async <T>(run: (client: Client) => Promise<T>): Promise<T> => {
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

export type TInsertedAssignment = {
  assignmentId: string;
  // The student's part of the assignment: the row that has the status, the grade and the file.
  assignmentStudentId: string;
};

// Gives a new assignment (of the student's teacher) to the student, as TODO.
export const insertAssignment = (studentId: string): Promise<TInsertedAssignment> =>
  withTestDb(async (client) => {
    const assignment = await client.query(
      `insert into "Assignment" (id, title, description, "dueDate", "teacherId")
       select gen_random_uuid(), 'מטלת בדיקה', '<p>בדיקה</p>', current_date, "teacherId"
       from "Student" where id = $1::uuid
       returning id`,
      [studentId],
    );
    const assignmentId: string = assignment.rows[0].id;
    const part = await client.query(
      `insert into "AssignmentStudent" (id, "assignmentId", "studentId")
       values (gen_random_uuid(), $1::uuid, $2::uuid) returning id`,
      [assignmentId, studentId],
    );
    return { assignmentId, assignmentStudentId: part.rows[0].id };
  });

// How many assignments the student has.
export const countAssignments = (studentId: string): Promise<number> =>
  withTestDb(async (client) => {
    const result = await client.query('select count(*)::int as count from "AssignmentStudent" where "studentId" = $1', [
      studentId,
    ]);
    return result.rows[0].count as number;
  });

// The student's part of an assignment, uploaded and maybe graded, as the file endpoint will save it later.
export const submitPart = (
  assignmentId: string,
  studentId: string,
  { submittedAt, grade, mimeType }: { submittedAt: string; grade: number | null; mimeType: string },
): Promise<void> =>
  withTestDb(async (client) => {
    const part = await client.query(
      `update "AssignmentStudent" set status = $3::"AssignmentStatus", grade = $4, "submittedAt" = ($5::timestamptz at time zone 'UTC')
       where "assignmentId" = $1::uuid and "studentId" = $2::uuid returning id`,
      [assignmentId, studentId, grade === null ? "SUBMITTED" : "CHECKED", grade, submittedAt],
    );
    const bytes: Buffer = Buffer.from("%PDF-1.4 test");
    await client.query(
      `insert into "SubmissionFile" (id, "assignmentStudentId", name, "mimeType", size, data)
       values (gen_random_uuid(), $1::uuid, 'עבודה.pdf', $2, $3, $4)`,
      [part.rows[0].id, mimeType, bytes.length, bytes],
    );
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

// The add and edit pages share one form. The class is chosen by its name.
export type TStudentFormValues = { name: string; phone: string; className: string };

export const fillStudentForm = async (page: Page, { name, phone, className }: TStudentFormValues): Promise<void> => {
  await page.getByLabel("שם התלמיד").fill(name);
  await page.getByLabel("טלפון").fill(phone);
  await page.getByLabel("כיתה").selectOption({ label: className });
};

// The submit button says "הוספה" on the add page and "שמירה" on the edit page.
export const submitStudentForm = (page: Page, label: "הוספה" | "שמירה"): Promise<void> =>
  page.getByRole("button", { name: label, exact: true }).click();
