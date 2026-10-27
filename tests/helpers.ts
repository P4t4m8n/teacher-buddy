import { expect, type APIRequestContext, type APIResponse, type Locator, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
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

// The server counts failed sign-ins per client address (x-forwarded-for) and name, and refuses a client after a few.
export const uniqueClientIp = (): string => `10.${randomDigits(3)}.${randomDigits(3)}.${randomDigits(3)}`;
export const clientHeaders = (ip: string = uniqueClientIp()): Record<string, string> => ({ "x-forwarded-for": ip });

// Signs the request context in as a seeded teacher.
export const signInAs = async (request: APIRequestContext, seed: TSeedTeacher): Promise<void> => {
  const login = await request.post("/api/auth/login", {
    data: { name: seed.name, idNumber: seed.idNumber },
  });
  expect(login.status()).toBe(200);
};

// The dev server closes idle keep-alive connections after about 5 seconds.
const getWithRetry = async (request: APIRequestContext, url: string): Promise<APIResponse> => {
  try {
    return await request.get(url);
  } catch (error: unknown) {
    if (!String(error).includes("ECONNRESET")) throw error;
    return request.get(url);
  }
};

// Deletes something through the API for a test that needs it to be gone (a "deleted meanwhile" case, done while a page is open).
export const removeViaApi = async (request: APIRequestContext, url: string): Promise<void> => {
  let status: number;
  try {
    status = (await request.delete(url)).status();
  } catch (error: unknown) {
    if (!String(error).includes("ECONNRESET")) throw error;
    status = (await request.delete(url)).status();
  }
  expect([200, 404]).toContain(status);
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

// One assignment of the signed-in teacher with its students, or undefined when it does not exist (any more).
export const getAssignmentById = async (request: APIRequestContext, id: string): Promise<TTeacherAssignment | undefined> => {
  const response = await getWithRetry(request, `/api/assignments/${id}`);
  if (response.status() === 404) return undefined;
  expect(response.status()).toBe(200);
  return (await response.json()).assignment;
};

// The assignment with this title (the tests give every title once), found through the light list and then read
// alone. Reading every assignment of a write teacher would grow with every test of the run.
export const getAssignmentByTitle = async (request: APIRequestContext, title: string): Promise<TTeacherAssignment | undefined> => {
  const item: TAssignmentListItem | undefined = (await getAssignmentList(request)).find((candidate) => candidate.title === title);
  return item ? getAssignmentById(request, item.id) : undefined;
};

// Every assignment of the signed-in teacher with its students, in the order of the list. An assignment that
// another test deleted between the list and its details is left out. For the demo teachers, who have a few.
export const getAssignmentsWithStudents = async (request: APIRequestContext): Promise<TTeacherAssignment[]> => {
  const found = await Promise.all(
    (await getAssignmentList(request)).map(({ id }: TAssignmentListItem) => getAssignmentById(request, id)),
  );
  return found.filter((assignment): assignment is TTeacherAssignment => assignment !== undefined);
};

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

// The class select of the student form. By name, not by label: the dashboard's class filter (kept in the page
// while another page is open) has a label with the same word.
export const classField = (page: Page): Locator => page.locator('select[name="classId"]');

export const fillStudentForm = async (page: Page, { name, phone, className }: TStudentFormValues): Promise<void> => {
  await page.getByLabel("שם התלמיד").fill(name);
  await page.getByLabel("טלפון").fill(phone);
  await classField(page).selectOption({ label: className });
};

// The submit button says "הוספה" on the add page and "שמירה" on the edit page.
export const submitStudentForm = (page: Page, label: "הוספה" | "שמירה"): Promise<void> =>
  page.getByRole("button", { name: label, exact: true }).click();

// A teacher made only for one test file, with many students and assignments, so a list has more than one page.
export type TBulkTeacher = {
  id: string;
  name: string;
  idNumber: string;
  classNames: [string, string];
};

export const BULK_STUDENT_COUNT = 45;
export const BULK_ASSIGNMENT_COUNT = 45;

export const createBulkTeacher = async (): Promise<TBulkTeacher> => {
  const name: string = `מורה לדפדוף ${randomLetters(10)}`;
  const idNumber: string = randomDigits(9);
  const classNames: [string, string] = ["כיתה ראשונה", "כיתה שנייה"];
  const passwordHash: string = await hash(idNumber);

  const id: string = await withTestDb(async (client) => {
    const teacher = await client.query(
      `insert into "Teacher" (id, name, "passwordHash") values (gen_random_uuid(), $1, $2) returning id`,
      [name, passwordHash],
    );
    const teacherId: string = teacher.rows[0].id;
    const classes = await client.query(
      `insert into "Class" (id, name, "teacherId")
       select gen_random_uuid(), unnest($1::text[]), $2::uuid returning id, name`,
      [classNames, teacherId],
    );
    const classId = (className: string): string => classes.rows.find((row) => row.name === className).id;
    await client.query(
      `insert into "Student" (id, name, phone, "teacherId", "classId")
       select gen_random_uuid(), 'תלמיד ' || lpad(g::text, 3, '0'), '050-' || lpad(g::text, 7, '0'), $1::uuid,
              (case when g % 2 = 0 then $2 else $3 end)::uuid
       from generate_series(1, $4::int) g`,
      [teacherId, classId(classNames[0]), classId(classNames[1]), BULK_STUDENT_COUNT],
    );
    await client.query(
      `with a as (
         insert into "Assignment" (id, title, description, "dueDate", "teacherId")
         select gen_random_uuid(), 'מטלה ' || lpad(g::text, 3, '0'), '<p>בדיקה</p>', date '2026-01-01' + g, $1::uuid
         from generate_series(1, $2::int) g
         returning id, title
       ), s as (
         select id, row_number() over (order by name) as rn from "Student" where "teacherId" = $1::uuid order by name limit 3
       )
       insert into "AssignmentStudent" (id, "assignmentId", "studentId", status, "submittedAt")
       select gen_random_uuid(), a.id, s.id,
              (case when s.rn <= right(a.title, 3)::int % 4 then 'SUBMITTED' else 'TODO' end)::"AssignmentStatus",
              case when s.rn <= right(a.title, 3)::int % 4 then now() end
       from a cross join s`,
      [teacherId, BULK_ASSIGNMENT_COUNT],
    );
    return teacherId;
  });

  return { id, name, idNumber, classNames };
};

// Deletes the teacher and, by the database's cascade, everything that belongs to it.
export const deleteBulkTeacher = (teacher: TBulkTeacher): Promise<void> =>
  withTestDb(async (client) => {
    await client.query(`delete from "Teacher" where id = $1::uuid`, [teacher.id]);
  });

// The students and the assignments lists show 20 rows at a time, and the lists of the write teachers grow with every
// test that adds data. So a test that needs the row it made looks for it by its name, as a teacher would: by searching.
export const findInList = async (page: Page, text: string): Promise<void> => {
  await page.getByRole("searchbox", { name: "חיפוש" }).fill(text);
};

// The address of a list that is already searching for this text.
export const listAddress = (path: string, search: string): string => `${path}?q=${encodeURIComponent(search)}`;
