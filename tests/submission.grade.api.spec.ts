import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TAssignmentStudent, TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import { getSeededStudentList, signInAs, signToken, submitPart, UNKNOWN_TEACHER_ID, withTestDb } from "./helpers";

const ASSIGNMENTS_URL = "/api/assignments";
const GRADE_MESSAGE = "הציון חייב להיות מספר שלם בין 0 ל-100";

// These tests create assignments in the shared test database, for the write teachers only (the global setup
// removes them before every run), so the read-only tests that count the other teachers' rows are not affected.

const gradeUrl = (assignmentId: string, studentId: string): string =>
  `${ASSIGNMENTS_URL}/${assignmentId}/students/${studentId}/grade`;

const grade = (request: APIRequestContext, assignmentId: string, studentId: string, data: unknown): Promise<APIResponse> =>
  request.put(gradeUrl(assignmentId, studentId), { data });

const createAssignment = async (request: APIRequestContext, studentIds: string[]): Promise<TTeacherAssignment> => {
  const response = await request.post(ASSIGNMENTS_URL, {
    data: {
      title: `מטלה ${Math.random().toString(36).slice(2, 8)}`,
      description: "<p>הנחיות</p>",
      dueDate: "2030-06-15",
      studentIds,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).assignment;
};

// The write teacher's students, and an assignment given to both. The first student has uploaded a file.
const setup = async (
  request: APIRequestContext,
): Promise<{ students: TStudent[]; assignment: TTeacherAssignment }> => {
  await signInAs(request, WRITE_SEED);
  const students: TStudent[] = await getSeededStudentList(request, WRITE_SEED);
  const assignment: TTeacherAssignment = await createAssignment(request, students.map(({ id }) => id));
  await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });
  return { students, assignment };
};

const partOf = async (request: APIRequestContext, assignmentId: string, studentId: string): Promise<TAssignmentStudent> => {
  const assignment: TTeacherAssignment = (await (await request.get(`${ASSIGNMENTS_URL}/${assignmentId}`)).json()).assignment;
  const part = assignment.students.find((student) => student.studentId === studentId);
  if (!part) throw new Error("The student is not in the assignment");
  return part;
};

const readStoredPart = (assignmentId: string, studentId: string): Promise<{ status: string; grade: number | null; hasFile: boolean }> =>
  withTestDb(async (client) => {
    const result = await client.query(
      `select s.status, s.grade, (f.id is not null) as "hasFile"
       from "AssignmentStudent" s left join "SubmissionFile" f on f."assignmentStudentId" = s.id
       where s."assignmentId" = $1::uuid and s."studentId" = $2::uuid`,
      [assignmentId, studentId],
    );
    return result.rows[0];
  });

test.describe("PUT /api/assignments/[id]/students/[studentId]/grade: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await grade(request, UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID, { grade: 90 });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("checks the session before the body: 401 even for an invalid body", async ({ request }) => {
    expect((await grade(request, UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID, {})).status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.put(gradeUrl(UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID), {
      data: { grade: 90 },
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const response = await request.put(gradeUrl(UNKNOWN_TEACHER_ID, UNKNOWN_TEACHER_ID), {
      data: { grade: 90 },
      headers: { Cookie: `session=${await signToken(UNKNOWN_TEACHER_ID, "1h")}` },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/grade: saving a grade", () => {
  test("saves the grade and makes the part CHECKED, keeping the file and the date", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[0].id, { grade: 87 });

    expect(response.status()).toBe(200);
    const { student } = await response.json();
    expect(Object.keys(student).sort()).toEqual(["className", "file", "grade", "name", "status", "studentId", "submittedAt"]);
    expect(student).toMatchObject({
      studentId: students[0].id,
      status: "CHECKED",
      grade: 87,
      submittedAt: "2030-06-01",
      file: { name: "עבודה.pdf", kind: "pdf" },
    });
    expect(await readStoredPart(assignment.id, students[0].id)).toEqual({ status: "CHECKED", grade: 87, hasFile: true });
  });

  test("is saved: the assignment shows the part as CHECKED, and the other student is not touched", async ({ request }) => {
    const { students, assignment } = await setup(request);

    await grade(request, assignment.id, students[0].id, { grade: 70 });

    expect(await partOf(request, assignment.id, students[0].id)).toMatchObject({ status: "CHECKED", grade: 70 });
    expect(await partOf(request, assignment.id, students[1].id)).toMatchObject({ status: "TODO", grade: null, file: null });
  });

  for (const value of [0, 1, 100]) {
    test(`accepts the grade ${value}, also the lowest and the highest`, async ({ request }) => {
      const { students, assignment } = await setup(request);

      const response = await grade(request, assignment.id, students[0].id, { grade: value });

      expect(response.status()).toBe(200);
      expect((await response.json()).student).toMatchObject({ status: "CHECKED", grade: value });
      expect(await readStoredPart(assignment.id, students[0].id)).toMatchObject({ status: "CHECKED", grade: value });
    });
  }

  test("changes a grade that was already given", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await grade(request, assignment.id, students[0].id, { grade: 60 });

    const response = await grade(request, assignment.id, students[0].id, { grade: 95 });

    expect((await response.json()).student).toMatchObject({ status: "CHECKED", grade: 95 });
    expect(await readStoredPart(assignment.id, students[0].id)).toMatchObject({ status: "CHECKED", grade: 95 });
  });

  test("clears the grade with null, and the part is SUBMITTED again with its file", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await grade(request, assignment.id, students[0].id, { grade: 88 });

    const response = await grade(request, assignment.id, students[0].id, { grade: null });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ status: "SUBMITTED", grade: null, submittedAt: "2030-06-01", file: { kind: "pdf" } });
    expect(await readStoredPart(assignment.id, students[0].id)).toEqual({ status: "SUBMITTED", grade: null, hasFile: true });
  });

  test("clearing a grade that is not there changes nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[0].id, { grade: null });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ status: "SUBMITTED", grade: null });
  });

  test("clearing a grade of a student with no file is fine, and the part stays TODO", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[1].id, { grade: null });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ status: "TODO", grade: null, file: null });
  });

  test("never takes the status, the teacher or the student from the body", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[0].id, {
      grade: 50,
      status: "TODO",
      teacherId: UNKNOWN_TEACHER_ID,
      studentId: students[1].id,
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toMatchObject({ studentId: students[0].id, status: "CHECKED", grade: 50 });
    expect((await partOf(request, assignment.id, students[1].id)).grade).toBeNull();
  });

  test("a new file for a checked part keeps the grade, and the grade can still be changed", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await grade(request, assignment.id, students[0].id, { grade: 75 });
    const pdf = { name: "fixed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 fixed") };
    await request.put(`${ASSIGNMENTS_URL}/${assignment.id}/students/${students[0].id}/file`, { multipart: { file: pdf } });

    expect(await partOf(request, assignment.id, students[0].id)).toMatchObject({ status: "CHECKED", grade: 75, file: { name: "fixed.pdf" } });
    const response = await grade(request, assignment.id, students[0].id, { grade: 82 });

    expect((await response.json()).student).toMatchObject({ status: "CHECKED", grade: 82, file: { name: "fixed.pdf" } });
  });

  test("works for a student whose file was uploaded with the file endpoint", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const students: TStudent[] = await getSeededStudentList(request, WRITE_SEED);
    const assignment: TTeacherAssignment = await createAssignment(request, [students[0].id]);
    const pdf = { name: "work.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 work") };
    await request.put(`${ASSIGNMENTS_URL}/${assignment.id}/students/${students[0].id}/file`, { multipart: { file: pdf } });

    const response = await grade(request, assignment.id, students[0].id, { grade: 99 });

    expect((await response.json()).student).toMatchObject({ status: "CHECKED", grade: 99 });
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/grade: a grade that is refused", () => {
  test("returns 409 for a student with no file, and saves nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[1].id, { grade: 90 });

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.gradeNeedsFile });
    expect(await readStoredPart(assignment.id, students[1].id)).toEqual({ status: "TODO", grade: null, hasFile: false });
  });

  test("returns 409 also for a grade of 0 when there is no file", async ({ request }) => {
    const { students, assignment } = await setup(request);

    expect((await grade(request, assignment.id, students[1].id, { grade: 0 })).status()).toBe(409);
  });

  const INVALID: [string, unknown][] = [
    ["below 0", -1],
    ["above 100", 101],
    ["not a whole number", 85.5],
    ["a text", "85"],
    ["a boolean", true],
    ["a list", [85]],
    ["an object", { value: 85 }],
  ];

  for (const [label, value] of INVALID) {
    test(`returns 400 with one Hebrew message for a grade that is ${label}, and saves nothing`, async ({ request }) => {
      const { students, assignment } = await setup(request);

      const response = await grade(request, assignment.id, students[0].id, { grade: value });

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: ERROR_MESSAGES.validation, fields: { grade: [GRADE_MESSAGE] } });
      expect(await readStoredPart(assignment.id, students[0].id)).toEqual({ status: "SUBMITTED", grade: null, hasFile: true });
    });
  }

  test("returns 400 when the grade is missing", async ({ request }) => {
    const { students, assignment } = await setup(request);

    const response = await grade(request, assignment.id, students[0].id, {});

    expect(response.status()).toBe(400);
    expect((await response.json()).fields).toEqual({ grade: [GRADE_MESSAGE] });
  });

  test("returns 400 for a body that is not an object or not JSON", async ({ request }) => {
    const { students, assignment } = await setup(request);

    for (const body of [null, [], "text", 5]) {
      expect((await grade(request, assignment.id, students[0].id, body)).status()).toBe(400);
    }
    const notJson = await request.put(gradeUrl(assignment.id, students[0].id), {
      data: Buffer.from("{not json"),
      headers: { "Content-Type": "application/json" },
    });
    expect(notJson.status()).toBe(400);
    expect((await notJson.json()).error).toBe(ERROR_MESSAGES.invalidJson);
  });

  test("a refused grade does not change a grade that was already given", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await grade(request, assignment.id, students[0].id, { grade: 64 });

    expect((await grade(request, assignment.id, students[0].id, { grade: 101 })).status()).toBe(400);

    expect(await readStoredPart(assignment.id, students[0].id)).toEqual({ status: "CHECKED", grade: 64, hasFile: true });
  });
});

test.describe("PUT /api/assignments/[id]/students/[studentId]/grade: not found", () => {
  const expectNotFound = async (response: APIResponse): Promise<void> => {
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.assignmentNotFound });
  };

  test("returns 404 for an assignment that does not exist", async ({ request }) => {
    const { students } = await setup(request);

    await expectNotFound(await grade(request, UNKNOWN_TEACHER_ID, students[0].id, { grade: 90 }));
  });

  test("returns the same 404 for a student of the teacher who is not in the assignment", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const students: TStudent[] = await getSeededStudentList(request, WRITE_SEED);
    const assignment: TTeacherAssignment = await createAssignment(request, [students[0].id]);

    await expectNotFound(await grade(request, assignment.id, students[1].id, { grade: 90 }));
  });

  test("returns the same 404 for an assignment of another teacher, and saves nothing", async ({ request }) => {
    const { students, assignment } = await setup(request);
    await signInAs(request, WRITE_OTHER_SEED);

    await expectNotFound(await grade(request, assignment.id, students[0].id, { grade: 90 }));

    expect(await readStoredPart(assignment.id, students[0].id)).toMatchObject({ status: "SUBMITTED", grade: null });
  });

  test("returns the same 404 for ids that are not uuids", async ({ request }) => {
    const { students, assignment } = await setup(request);

    for (const [assignmentId, studentId] of [
      ["abc", students[0].id],
      [assignment.id, "abc"],
      ["' OR 1=1 --", "123"],
    ]) {
      await expectNotFound(await grade(request, assignmentId, studentId, { grade: 90 }));
    }
  });
});
