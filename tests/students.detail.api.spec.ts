import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TStudent } from "../types/student.type";
import {
  countAssignments,
  getClassList,
  getStudentList,
  insertAssignment,
  signInAs,
  signToken,
  UNKNOWN_TEACHER_ID,
  uniqueName,
  uniquePhone,
} from "./helpers";

const studentUrl = (id: string): string => `/api/students/${id}`;
const NOT_FOUND_BODY = { error: ERROR_MESSAGES.studentNotFound };
const NOT_UUIDS: string[] = ["abc", "1", "null", "0198f0a2-7b3c", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz"];

// These tests create and delete students, so they only use the write teachers (see helpers).
const createStudent = async (request: APIRequestContext): Promise<TStudent> => {
  const [studentClass] = await getClassList(request);
  const response: APIResponse = await request.post("/api/students", {
    data: { name: uniqueName(), phone: uniquePhone(), classId: studentClass.id },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).student;
};

const idsInList = async (request: APIRequestContext): Promise<string[]> =>
  (await getStudentList(request)).map(({ id }) => id);

test.describe("GET /api/students/[id]: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get(studentUrl(UNKNOWN_TEACHER_ID));

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("checks the session before the id: 401 even for a malformed id", async ({ request }) => {
    expect((await request.get(studentUrl("abc"))).status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.get(studentUrl(UNKNOWN_TEACHER_ID), {
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.get(studentUrl(UNKNOWN_TEACHER_ID), {
      headers: { Cookie: `session=${token}` },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 again after logout", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const [student] = await getStudentList(request);
    expect((await request.get(studentUrl(student.id))).status()).toBe(200);

    await request.post("/api/auth/logout");

    expect((await request.get(studentUrl(student.id))).status()).toBe(401);
  });
});

test.describe("GET /api/students/[id]: data", () => {
  test("returns the student, the same as in the list", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const students = await getStudentList(request);

    for (const listed of students.slice(0, 3)) {
      const response = await request.get(studentUrl(listed.id));

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ student: listed });
    }
  });

  test("returns only id, name, phone and the class", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const [listed] = await getStudentList(request);

    const { student } = await (await request.get(studentUrl(listed.id))).json();

    expect(Object.keys(student).sort()).toEqual(["class", "id", "name", "phone"]);
    expect(Object.keys(student.class).sort()).toEqual(["id", "name"]);
  });

  test("returns a student that was just created", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const created = await createStudent(request);

    const response = await request.get(studentUrl(created.id));

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ student: created });
  });

  test("returns 404 for another teacher's student, the same as for one that does not exist", async ({
    request,
    playwright,
    baseURL,
  }) => {
    await signInAs(request, DEMO_SEED);
    const [demoStudent] = await getStudentList(request);
    const other = await playwright.request.newContext({ baseURL });
    await signInAs(other, WRITE_SEED);

    const foreign = await other.get(studentUrl(demoStudent.id));
    const missing = await other.get(studentUrl(UNKNOWN_TEACHER_ID));

    expect(foreign.status()).toBe(404);
    expect(missing.status()).toBe(404);
    expect(await foreign.json()).toEqual(NOT_FOUND_BODY);
    expect(await missing.json()).toEqual(await foreign.json());
    await other.dispose();
  });

  test("returns 404 for a student that does not exist", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const response = await request.get(studentUrl(UNKNOWN_TEACHER_ID));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
  });

  test("returns 404, not a server error, for an id that is not a uuid", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    for (const id of NOT_UUIDS) {
      const response = await request.get(studentUrl(id));
      expect(response.status(), id).toBe(404);
      expect(await response.json(), id).toEqual(NOT_FOUND_BODY);
    }
  });
});

test.describe("DELETE /api/students/[id]: authorization", () => {
  test("returns 401 without a session, and deletes nothing", async ({ request, playwright, baseURL }) => {
    await signInAs(request, WRITE_SEED);
    const student = await createStudent(request);
    const anonymous = await playwright.request.newContext({ baseURL });

    const response = await anonymous.delete(studentUrl(student.id));

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
    expect(await idsInList(request)).toContain(student.id);
    await anonymous.dispose();
  });

  test("checks the session before the id: 401 even for a malformed id", async ({ request }) => {
    expect((await request.delete(studentUrl("abc"))).status()).toBe(401);
  });

  test("returns 401 for a forged cookie, and for a token of a teacher that does not exist", async ({
    request,
  }) => {
    const forged = await request.delete(studentUrl(UNKNOWN_TEACHER_ID), {
      headers: { Cookie: "session=forged.token.value" },
    });
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");
    const noTeacher = await request.delete(studentUrl(UNKNOWN_TEACHER_ID), {
      headers: { Cookie: `session=${token}` },
    });

    expect(forged.status()).toBe(401);
    expect(noTeacher.status()).toBe(401);
  });

  test("returns 401 after logout", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const student = await createStudent(request);
    await request.post("/api/auth/logout");

    expect((await request.delete(studentUrl(student.id))).status()).toBe(401);
  });
});

test.describe("DELETE /api/students/[id]: deleting", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("deletes the student: 200 with the id, gone from the list and from the details", async ({
    request,
  }) => {
    const student = await createStudent(request);

    const response = await request.delete(studentUrl(student.id));

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ id: student.id });
    expect(await idsInList(request)).not.toContain(student.id);
    expect((await request.get(studentUrl(student.id))).status()).toBe(404);
  });

  test("deleting the same student again returns 404", async ({ request }) => {
    const student = await createStudent(request);
    expect((await request.delete(studentUrl(student.id))).status()).toBe(200);

    const again = await request.delete(studentUrl(student.id));

    expect(again.status()).toBe(404);
    expect(await again.json()).toEqual(NOT_FOUND_BODY);
  });

  test("deletes only that student: the others stay, including the seeded ones", async ({ request }) => {
    const target = await createStudent(request);
    const bystander = await createStudent(request);

    await request.delete(studentUrl(target.id));

    const ids = await idsInList(request);
    expect(ids).toContain(bystander.id);
    const names = (await getStudentList(request)).map(({ name }) => name);
    for (const { students } of WRITE_SEED.classes) {
      for (const { name } of students) expect(names).toContain(name);
    }
  });

  test("returns 404 for a student that does not exist", async ({ request }) => {
    const response = await request.delete(studentUrl(UNKNOWN_TEACHER_ID));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
  });

  test("returns 404, not a server error, for an id that is not a uuid", async ({ request }) => {
    for (const id of NOT_UUIDS) {
      const response = await request.delete(studentUrl(id));
      expect(response.status(), id).toBe(404);
      expect(await response.json(), id).toEqual(NOT_FOUND_BODY);
    }
  });

  test("another teacher cannot delete the student: the same 404, and the student is still there", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const student = await createStudent(request);
    const other = await playwright.request.newContext({ baseURL });
    await signInAs(other, WRITE_OTHER_SEED);

    const response = await other.delete(studentUrl(student.id));

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
    expect(await idsInList(request)).toContain(student.id);
    expect((await request.get(studentUrl(student.id))).status()).toBe(200);
    await other.dispose();
  });

  test("the same name and phone can be added again after the student was deleted", async ({ request }) => {
    const [studentClass] = await getClassList(request);
    const data = { name: uniqueName(), phone: uniquePhone(), classId: studentClass.id };
    const first = await request.post("/api/students", { data });
    expect(first.status()).toBe(201);
    expect((await request.post("/api/students", { data })).status()).toBe(409);

    await request.delete(studentUrl((await first.json()).student.id));

    expect((await request.post("/api/students", { data })).status()).toBe(201);
  });

  test("deletes the student's assignments too, and no one else's", async ({ request }) => {
    const target = await createStudent(request);
    const bystander = await createStudent(request);
    await insertAssignment(target.id);
    await insertAssignment(target.id);
    await insertAssignment(bystander.id);
    expect(await countAssignments(target.id)).toBe(2);

    const response = await request.delete(studentUrl(target.id));

    expect(response.status()).toBe(200);
    expect(await countAssignments(target.id)).toBe(0);
    expect(await countAssignments(bystander.id)).toBe(1);
  });

  test("a deleted student of one class does not remove the class", async ({ request }) => {
    const classesBefore = await getClassList(request);
    const student = await createStudent(request);

    await request.delete(studentUrl(student.id));

    expect(await getClassList(request)).toEqual(classesBefore);
  });

  test("only GET and DELETE are allowed on a student", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.post(studentUrl(student.id), { data: {} });

    expect(response.status()).toBe(405);
  });
});
