import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import { getStudentList, signInAs, signToken, submitPart, UNKNOWN_TEACHER_ID, withTestDb } from "./helpers";

const ASSIGNMENTS_URL = "/api/assignments";

// These tests create assignments in the shared test database, for the write teachers only (the global setup
// removes them before every run), so the read-only tests that count the other teachers' rows are not affected.

const body = (studentIds: string[], overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: `מטלה ${Math.random().toString(36).slice(2, 8)}`,
  description: "<p>הנחיות</p>",
  dueDate: "2030-06-15",
  studentIds,
  ...overrides,
});

const create = async (request: APIRequestContext, studentIds: string[]): Promise<TTeacherAssignment> => {
  const response = await request.post(ASSIGNMENTS_URL, { data: body(studentIds) });
  expect(response.status()).toBe(201);
  return (await response.json()).assignment;
};

const update = (request: APIRequestContext, id: string, data: unknown): Promise<APIResponse> =>
  request.put(`${ASSIGNMENTS_URL}/${id}`, { data });

const read = async (request: APIRequestContext, id: string): Promise<TTeacherAssignment> => {
  const response = await request.get(`${ASSIGNMENTS_URL}/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()).assignment;
};

// The two students of the write teacher, and an assignment given to the first one.
const setup = async (request: APIRequestContext): Promise<{ students: TStudent[]; assignment: TTeacherAssignment }> => {
  await signInAs(request, WRITE_SEED);
  const students: TStudent[] = await getStudentList(request);
  return { students, assignment: await create(request, [students[0].id]) };
};

const countRows = (assignmentId: string): Promise<{ parts: number; files: number; assignments: number }> =>
  withTestDb(async (client) => {
    const result = await client.query(
      `select
         (select count(*)::int from "Assignment" where id = $1::uuid) as assignments,
         (select count(*)::int from "AssignmentStudent" where "assignmentId" = $1::uuid) as parts,
         (select count(*)::int from "SubmissionFile" f
            join "AssignmentStudent" s on s.id = f."assignmentStudentId" where s."assignmentId" = $1::uuid) as files`,
      [assignmentId],
    );
    return result.rows[0];
  });

const studentIdsOf = (assignment: TTeacherAssignment): string[] => assignment.students.map(({ studentId }) => studentId).sort();

test.describe("PUT and DELETE /api/assignments/[id]: authorization", () => {
  test("return 401 without a session", async ({ request }) => {
    const put = await update(request, UNKNOWN_TEACHER_ID, body([UNKNOWN_TEACHER_ID]));
    const del = await request.delete(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`);

    for (const response of [put, del]) {
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
    }
  });

  test("check the session before the body: 401 even for an invalid body", async ({ request }) => {
    expect((await update(request, UNKNOWN_TEACHER_ID, {})).status()).toBe(401);
  });

  test("return 401 for a forged cookie", async ({ request }) => {
    const headers = { Cookie: "session=forged.token.value" };

    expect((await request.put(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`, { data: {}, headers })).status()).toBe(401);
    expect((await request.delete(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`, { headers })).status()).toBe(401);
  });

  test("return 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const headers = { Cookie: `session=${await signToken(UNKNOWN_TEACHER_ID, "1h")}` };

    expect((await request.put(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`, { data: {}, headers })).status()).toBe(401);
    expect((await request.delete(`${ASSIGNMENTS_URL}/${UNKNOWN_TEACHER_ID}`, { headers })).status()).toBe(401);
  });
});

test.describe("PUT /api/assignments/[id]", () => {
  test("replaces the title, the description and the due date, and keeps the id", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await update(
      request,
      assignment.id,
      body([students[0].id], { title: "  כותרת חדשה ", description: "<p>חדש</p>", dueDate: "2031-02-03" }),
    );

    expect(response.status()).toBe(200);
    const updated: TTeacherAssignment = (await response.json()).assignment;
    expect(updated).toMatchObject({ id: assignment.id, title: "כותרת חדשה", description: "<p>חדש</p>", dueDate: "2031-02-03" });
    expect(await read(request, assignment.id)).toEqual(updated);
  });

  test("cleans the description like a create does", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await update(
      request,
      assignment.id,
      body([students[0].id], { description: '<p onclick="x()">שלום</p><script>alert(1)</script>' }),
    );

    expect((await response.json()).assignment.description).toBe("<p>שלום</p>");
  });

  test("adds a student, who starts as TODO", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await update(request, assignment.id, body([students[0].id, students[1].id]));

    expect(response.status()).toBe(200);
    const updated: TTeacherAssignment = (await response.json()).assignment;
    expect(studentIdsOf(updated)).toEqual([students[0].id, students[1].id].sort());
    expect(updated.students.find(({ studentId }) => studentId === students[1].id)).toMatchObject({
      status: "TODO",
      grade: null,
      submittedAt: null,
      file: null,
    });
  });

  test("removes a student who has not submitted", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await update(request, assignment.id, body([students[0].id, students[1].id]));

    const response = await update(request, assignment.id, body([students[1].id]));

    expect(response.status()).toBe(200);
    expect(studentIdsOf((await response.json()).assignment)).toEqual([students[1].id]);
    expect((await countRows(assignment.id)).parts).toBe(1);
  });

  test("keeps the file, the grade and the status of a student who stays", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 85, mimeType: "application/pdf" });

    const response = await update(request, assignment.id, body([students[0].id, students[1].id], { title: "שם אחר" }));

    expect(response.status()).toBe(200);
    const kept = (await response.json()).assignment.students.find(({ studentId }: { studentId: string }) => studentId === students[0].id);
    expect(kept).toMatchObject({ status: "CHECKED", grade: 85, submittedAt: "2030-06-01", file: { name: "עבודה.pdf", kind: "pdf" } });
    expect((await countRows(assignment.id)).files).toBe(1);
  });

  test("returns 409 when a student who submitted is removed, and changes nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await update(request, assignment.id, body([students[0].id, students[1].id]));
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });
    const before: TTeacherAssignment = await read(request, assignment.id);

    const response = await update(
      request,
      assignment.id,
      body([students[1].id], { title: "לא אמור להישמר", dueDate: "2040-01-01" }),
    );

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentStudentSubmitted });
    // The title and the date are not saved either, and the student who was not submitted is still in.
    expect(await read(request, assignment.id)).toEqual(before);
    expect((await countRows(assignment.id)).files).toBe(1);
  });

  test("returns 409 also for a student whose assignment is checked", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await update(request, assignment.id, body([students[0].id, students[1].id]));
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 70, mimeType: "image/png" });

    const response = await update(request, assignment.id, body([students[1].id]));

    expect(response.status()).toBe(409);
  });

  test("never takes the status, the grade or the teacher from the body", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await update(
      request,
      assignment.id,
      body([students[0].id], { status: "CHECKED", grade: 100, teacherId: UNKNOWN_TEACHER_ID, id: UNKNOWN_TEACHER_ID }),
    );

    expect(response.status()).toBe(200);
    const updated: TTeacherAssignment = (await response.json()).assignment;
    expect(updated.id).toBe(assignment.id);
    expect(updated.students[0]).toMatchObject({ status: "TODO", grade: null });
  });

  test("returns 400 with a Hebrew message for every wrong field, and changes nothing", async ({ request }) => {
    const { assignment } = await setup(request);

    const response = await update(request, assignment.id, { title: "", description: 5, dueDate: "x", studentIds: [] });

    expect(response.status()).toBe(400);
    const result = await response.json();
    expect(result.error).toBe(ERROR_MESSAGES.validation);
    expect(Object.keys(result.fields).sort()).toEqual(["description", "dueDate", "studentIds", "title"]);
    expect(await read(request, assignment.id)).toEqual(assignment);
  });

  test("returns 400 for a body that is not JSON", async ({ request }) => {
    const { assignment } = await setup(request);

    const response = await request.put(`${ASSIGNMENTS_URL}/${assignment.id}`, {
      data: Buffer.from("{not json"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(ERROR_MESSAGES.invalidJson);
  });

  test("returns 404 for a student that does not exist, and changes nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await update(request, assignment.id, body([students[0].id, UNKNOWN_TEACHER_ID], { title: "לא נשמר" }));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentNotFound });
    expect(await read(request, assignment.id)).toEqual(assignment);
  });

  test("returns the same 404 for a student of another teacher, and changes nothing", async ({ request }) => {
    await signInAs(request, WRITE_OTHER_SEED);
    const otherStudents: TStudent[] = await getStudentList(request);
    const { students, assignment } = await setup(request);

    const response = await update(request, assignment.id, body([students[0].id, otherStudents[0].id], { title: "לא נשמר" }));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentNotFound });
    expect(await read(request, assignment.id)).toEqual(assignment);
  });

  test("returns 404 for an assignment that does not exist", async ({ request }) => {
    const { students } = await setup(request);

    const response = await update(request, UNKNOWN_TEACHER_ID, body([students[0].id]));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  });

  test("returns the same 404 for an assignment of another teacher, and does not touch it", async ({ request }) => {
    const { assignment } = await setup(request);
    await signInAs(request, WRITE_OTHER_SEED);
    const otherStudents: TStudent[] = await getStudentList(request);

    const response = await update(request, assignment.id, body([otherStudents[0].id], { title: "נחטף" }));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    await signInAs(request, WRITE_SEED);
    expect(await read(request, assignment.id)).toEqual(assignment);
  });

  test("returns the same 404 for an id that is not a uuid", async ({ request }) => {
    const { students } = await setup(request);

    for (const id of ["abc", "123", "' OR 1=1 --"]) {
      const response = await update(request, id, body([students[0].id]));
      expect(response.status(), id).toBe(404);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    }
  });
});

test.describe("DELETE /api/assignments/[id]", () => {
  test("deletes the assignment, its parts and their files", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await update(request, assignment.id, body([students[0].id, students[1].id]));
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 90, mimeType: "application/pdf" });
    expect(await countRows(assignment.id)).toEqual({ assignments: 1, parts: 2, files: 1 });

    const response = await request.delete(`${ASSIGNMENTS_URL}/${assignment.id}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ id: assignment.id });
    expect(await countRows(assignment.id)).toEqual({ assignments: 0, parts: 0, files: 0 });
    expect((await request.get(`${ASSIGNMENTS_URL}/${assignment.id}`)).status()).toBe(404);
  });

  test("does not delete the students", async ({ request }) => {
    const { students, assignment } = await setup(request);

    await request.delete(`${ASSIGNMENTS_URL}/${assignment.id}`);

    expect((await getStudentList(request)).map(({ id }) => id).sort()).toEqual(students.map(({ id }) => id).sort());
  });

  test("returns 404 when it is deleted again", async ({ request }) => {
    const { assignment } = await setup(request);
    await request.delete(`${ASSIGNMENTS_URL}/${assignment.id}`);

    const response = await request.delete(`${ASSIGNMENTS_URL}/${assignment.id}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  });

  test("returns the same 404 for an assignment of another teacher, and does not delete it", async ({ request }) => {
    const { assignment } = await setup(request);
    await signInAs(request, WRITE_OTHER_SEED);

    const response = await request.delete(`${ASSIGNMENTS_URL}/${assignment.id}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    expect((await countRows(assignment.id)).assignments).toBe(1);
  });

  test("returns the same 404 for an id that does not exist or is not a uuid", async ({ request }) => {
    await signInAs(request, WRITE_SEED);

    for (const id of [UNKNOWN_TEACHER_ID, "abc", "123", "' OR 1=1 --"]) {
      const response = await request.delete(`${ASSIGNMENTS_URL}/${id}`);
      expect(response.status(), id).toBe(404);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
    }
  });
});
