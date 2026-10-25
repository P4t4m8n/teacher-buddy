import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TAssignmentListItem, TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import {
  getStudentList,
  randomLetters,
  signInAs,
  signToken,
  submitPart,
  UNKNOWN_TEACHER_ID,
  withTestDb,
} from "./helpers";

const ASSIGNMENTS_URL = "/api/assignments";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// These tests create assignments in the shared test database, for the write teachers only (the global setup
// removes them before every run), so the read-only tests that count the other teachers' rows are not affected.

const createAssignment = (request: APIRequestContext, data: unknown): Promise<APIResponse> =>
  request.post(ASSIGNMENTS_URL, { data });

const validBody = (studentIds: string[], overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: `מטלה ${Math.random().toString(36).slice(2, 8)}`,
  description: "<p>הנחיות</p>",
  dueDate: "2030-06-15",
  studentIds,
  ...overrides,
});

const create = async (
  request: APIRequestContext,
  studentIds: string[],
  overrides: Record<string, unknown> = {},
): Promise<TTeacherAssignment> => {
  const response = await createAssignment(request, validBody(studentIds, overrides));
  expect(response.status()).toBe(201);
  return (await response.json()).assignment;
};

const list = async (request: APIRequestContext): Promise<TAssignmentListItem[]> => {
  const response = await request.get(ASSIGNMENTS_URL);
  expect(response.status()).toBe(200);
  return (await response.json()).assignments;
};

const writeStudents = async (request: APIRequestContext): Promise<TStudent[]> => {
  await signInAs(request, WRITE_SEED);
  return getStudentList(request);
};

const readStoredDescription = (assignmentId: string): Promise<string> =>
  withTestDb(async (client) => {
    const result = await client.query('select description from "Assignment" where id = $1::uuid', [assignmentId]);
    return result.rows[0].description;
  });

const readStoredTeacherName = (assignmentId: string): Promise<string> =>
  withTestDb(async (client) => {
    const result = await client.query(
      'select t.name from "Assignment" a join "Teacher" t on t.id = a."teacherId" where a.id = $1::uuid',
      [assignmentId],
    );
    return result.rows[0].name;
  });

// Titles are random, so this counts only what one test made even while other tests run in parallel.
const countWithTitle = (title: string): Promise<number> =>
  withTestDb(async (client) => {
    const result = await client.query('select count(*)::int as count from "Assignment" where title = $1', [title]);
    return result.rows[0].count;
  });

test.describe("assignments API: authorization", () => {
  const body = validBody([UNKNOWN_TEACHER_ID]);

  test("returns 401 without a session", async ({ request }) => {
    for (const response of [
      await request.get(ASSIGNMENTS_URL),
      await createAssignment(request, body),
      await request.get(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`),
    ]) {
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
    }
  });

  test("checks the session before the body: 401 even for an invalid body", async ({ request }) => {
    expect((await createAssignment(request, {})).status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const headers = { Cookie: "session=forged.token.value" };

    expect((await request.get(ASSIGNMENTS_URL, { headers })).status()).toBe(401);
    expect((await request.post(ASSIGNMENTS_URL, { data: body, headers })).status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const headers = { Cookie: `session=${await signToken(UNKNOWN_TEACHER_ID, "1h")}` };

    expect((await request.get(ASSIGNMENTS_URL, { headers })).status()).toBe(401);
    expect((await request.post(ASSIGNMENTS_URL, { data: body, headers })).status()).toBe(401);
  });
});

test.describe("POST /api/assignments", () => {
  test("creates an assignment for several students, each one starting as TODO", async ({ request }) => {
    const students = await writeStudents(request);

    const response = await createAssignment(request, validBody(students.map(({ id }) => id), { title: "חיבור על הים" }));

    expect(response.status()).toBe(201);
    const { assignment } = await response.json();
    expect(Object.keys(assignment).sort()).toEqual(["description", "dueDate", "id", "students", "title"]);
    expect(assignment).toMatchObject({ title: "חיבור על הים", dueDate: "2030-06-15", description: "<p>הנחיות</p>" });
    expect(assignment.id).toMatch(UUID_PATTERN);
    expect(assignment.students).toHaveLength(students.length);
    for (const part of assignment.students) {
      expect(Object.keys(part).sort()).toEqual(["className", "file", "grade", "name", "status", "studentId", "submittedAt"]);
      expect(part).toMatchObject({ status: "TODO", grade: null, submittedAt: null, file: null });
    }
  });

  test("gives each student's name and class, ordered by name", async ({ request }) => {
    const students = await writeStudents(request);

    const assignment = await create(request, students.map(({ id }) => id));

    // The students list is ordered by name in the same database, so it is the order to expect.
    expect(assignment.students.map(({ studentId }) => studentId)).toEqual(students.map(({ id }) => id));
    for (const part of assignment.students) {
      const student = students.find(({ id }) => id === part.studentId);
      expect(part.name).toBe(student?.name);
      expect(part.className).toBe(student?.class.name);
    }
  });

  test("is saved: it can be read again, and is in the list", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);

    const read = await request.get(`${ASSIGNMENTS_URL}/${created.id}`);

    expect(read.status()).toBe(200);
    expect((await read.json()).assignment).toEqual(created);
    expect((await list(request)).map(({ id }) => id)).toContain(created.id);
  });

  test("belongs to the signed-in teacher, whatever the body says", async ({ request }) => {
    const students = await writeStudents(request);

    const response = await createAssignment(
      request,
      validBody([students[0].id], { teacherId: UNKNOWN_TEACHER_ID, id: UNKNOWN_TEACHER_ID, status: "CHECKED" }),
    );

    expect(response.status()).toBe(201);
    const { assignment } = await response.json();
    expect(assignment.id).not.toBe(UNKNOWN_TEACHER_ID);
    expect(await readStoredTeacherName(assignment.id)).toBe(WRITE_SEED.name);
    expect(assignment.students[0].status).toBe("TODO");
  });

  test("counts a student chosen twice once", async ({ request }) => {
    const students = await writeStudents(request);

    const assignment = await create(request, [students[0].id, students[0].id, students[1].id]);

    expect(assignment.students.map(({ studentId }) => studentId).sort()).toEqual(
      [students[0].id, students[1].id].sort(),
    );
  });

  test("trims the title", async ({ request }) => {
    const students = await writeStudents(request);

    expect((await create(request, [students[0].id], { title: "   חיבור   " })).title).toBe("חיבור");
  });

  test("works without a description", async ({ request }) => {
    const students = await writeStudents(request);
    const body = validBody([students[0].id]);
    delete body.description;

    const response = await createAssignment(request, body);

    expect(response.status()).toBe(201);
    expect((await response.json()).assignment.description).toBe("");
  });

  test("cleans the description before it is saved: nothing the editor cannot make reaches the database", async ({ request }) => {
    const students = await writeStudents(request);

    const assignment = await create(request, [students[0].id], {
      description:
        '<h2 onclick="x()">כותרת</h2><script>alert(1)</script><p style="color:red">יש <strong>לכתוב</strong></p>' +
        '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">קישור</a><iframe src="https://evil.example"></iframe>',
    });

    const stored: string = await readStoredDescription(assignment.id);
    expect(stored).toBe("<h2>כותרת</h2><p>יש <strong>לכתוב</strong></p>קישור");
    expect(assignment.description).toBe(stored);
  });

  test("keeps what the editor makes", async ({ request }) => {
    const students = await writeStudents(request);
    const html = "<h2>הנחיות</h2><p>יש <strong>לכתוב</strong> <em>היטב</em></p><ul><li><p>אחד</p></li></ul><ol><li><p>שניים</p></li></ol>";

    expect((await create(request, [students[0].id], { description: html })).description).toBe(html);
  });

  test("returns 400 with a Hebrew message for every wrong field, one message each", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const response = await createAssignment(request, { title: "", description: 5, dueDate: "x", studentIds: [] });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(ERROR_MESSAGES.validation);
    expect(Object.keys(body.fields).sort()).toEqual(["description", "dueDate", "studentIds", "title"]);
    for (const messages of Object.values<string[]>(body.fields)) {
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/[\u05D0-\u05EA]/);
    }
  });

  test("returns 400 for an empty object and for a body that is not an object", async ({ request }) => {
    await signInAs(request, WRITE_SEED);

    const empty = await createAssignment(request, {});
    expect(empty.status()).toBe(400);
    expect(Object.keys((await empty.json()).fields).sort()).toEqual(["dueDate", "studentIds", "title"]);

    for (const body of [null, [], "text", 5]) {
      expect((await createAssignment(request, body)).status()).toBe(400);
    }
  });

  test("returns 400 for a body that is not JSON", async ({ request }) => {
    await signInAs(request, WRITE_SEED);

    const response = await request.post(ASSIGNMENTS_URL, {
      data: Buffer.from("{not json"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(ERROR_MESSAGES.invalidJson);
  });

  test("returns 400 for a due date that does not exist", async ({ request }) => {
    const students = await writeStudents(request);

    for (const dueDate of ["2026-02-30", "2026-13-01", "15.12.2026", "1999-12-31", "2101-01-01"]) {
      const response = await createAssignment(request, validBody([students[0].id], { dueDate }));
      expect(response.status(), dueDate).toBe(400);
      expect(Object.keys((await response.json()).fields)).toEqual(["dueDate"]);
    }
  });

  test("returns 404 for a student that does not exist, and creates nothing", async ({ request }) => {
    const students = await writeStudents(request);
    const title: string = `מטלה ${randomLetters(12)}`;

    const response = await createAssignment(request, validBody([students[0].id, UNKNOWN_TEACHER_ID], { title }));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentNotFound });
    expect(await countWithTitle(title)).toBe(0);
  });

  test("returns the same 404 for a student of another teacher, and creates nothing", async ({ request }) => {
    await signInAs(request, WRITE_OTHER_SEED);
    const otherStudents = await getStudentList(request);
    const own = (await writeStudents(request))[0];
    const title: string = `מטלה ${randomLetters(12)}`;

    const response = await createAssignment(request, validBody([own.id, otherStudents[0].id], { title }));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentNotFound });
    expect(await countWithTitle(title)).toBe(0);
  });
});

test.describe("GET /api/assignments", () => {
  test("returns the assignments with the number of students and of submitted ones", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, students.map(({ id }) => id));
    await submitPart(created.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });
    await submitPart(created.id, students[1].id, { submittedAt: "2030-06-02T10:00:00Z", grade: 80, mimeType: "application/pdf" });

    const item = (await list(request)).find(({ id }) => id === created.id);

    expect(item).toEqual({
      id: created.id,
      title: created.title,
      dueDate: "2030-06-15",
      studentCount: 2,
      submittedCount: 2,
    });
  });

  test("does not count a student who has not submitted", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, students.map(({ id }) => id));
    await submitPart(created.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });

    const item = (await list(request)).find(({ id }) => id === created.id);

    expect(item).toMatchObject({ studentCount: 2, submittedCount: 1 });
  });

  test("does not carry the description or the students", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);

    const item = (await list(request)).find(({ id }) => id === created.id);

    expect(Object.keys(item ?? {}).sort()).toEqual(["dueDate", "id", "studentCount", "submittedCount", "title"]);
  });

  test("puts the latest due date first", async ({ request }) => {
    const students = await writeStudents(request);
    const early = await create(request, [students[0].id], { dueDate: "2090-01-01" });
    const late = await create(request, [students[0].id], { dueDate: "2091-01-01" });

    const ids: string[] = (await list(request)).map(({ id }) => id);

    expect(ids.indexOf(late.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(late.id)).toBeLessThan(ids.indexOf(early.id));
  });

  test("returns only the signed-in teacher's assignments", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);

    await signInAs(request, WRITE_OTHER_SEED);

    expect((await list(request)).map(({ id }) => id)).not.toContain(created.id);
  });
});

test.describe("GET /api/assignments/[id]", () => {
  test("returns 404 for an assignment that does not exist", async ({ request }) => {
    await signInAs(request, WRITE_SEED);

    const response = await request.get(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  });

  test("returns the same 404 for an assignment of another teacher", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);
    await signInAs(request, WRITE_OTHER_SEED);

    const response = await request.get(`${ASSIGNMENTS_URL}/${created.id}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  });

  test("returns the same 404 for an id that is not a uuid", async ({ request }) => {
    await signInAs(request, WRITE_SEED);

    for (const id of ["abc", "123", "' OR 1=1 --", "..%2F..%2Fetc"]) {
      const response = await request.get(`${ASSIGNMENTS_URL}/${id}`);
      expect(response.status(), id).toBe(404);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    }
  });

  test("gives the uploaded file of a student as a link, never its bytes", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);
    await submitPart(created.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 95, mimeType: "application/pdf" });

    const response = await request.get(`${ASSIGNMENTS_URL}/${created.id}`);

    const { assignment } = await response.json();
    expect(assignment.students[0]).toMatchObject({
      status: "CHECKED",
      grade: 95,
      file: {
        name: "עבודה.pdf",
        kind: "pdf",
        url: `/api/assignments/${created.id}/students/${students[0].id}/file`,
      },
    });
    expect(Object.keys(assignment.students[0].file).sort()).toEqual(["kind", "name", "url"]);
    expect(JSON.stringify(assignment)).not.toContain("PDF-1.4");
  });

  test("gives an image the kind image", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);
    await submitPart(created.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "image/png" });

    const { assignment } = await (await request.get(`${ASSIGNMENTS_URL}/${created.id}`)).json();

    expect(assignment.students[0]).toMatchObject({ status: "SUBMITTED", grade: null, file: { kind: "image" } });
  });

  test("keeps a grade of 0", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);
    await submitPart(created.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 0, mimeType: "application/pdf" });

    const { assignment } = await (await request.get(`${ASSIGNMENTS_URL}/${created.id}`)).json();

    expect(assignment.students[0]).toMatchObject({ status: "CHECKED", grade: 0 });
  });

  test("shows the day of the upload in Israel: 22:30 UTC in winter is already the next day", async ({ request }) => {
    const students = await writeStudents(request);
    const created = await create(request, [students[0].id]);
    await submitPart(created.id, students[0].id, { submittedAt: "2030-12-14T22:30:00Z", grade: null, mimeType: "application/pdf" });

    const { assignment } = await (await request.get(`${ASSIGNMENTS_URL}/${created.id}`)).json();

    expect(assignment.students[0].submittedAt).toBe("2030-12-15");
  });
});
