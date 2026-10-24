import { expect, test, type APIRequestContext } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TStudent } from "../types/student.type";
import {
  countAssignments,
  createStudent,
  getClassList,
  getStudentList,
  insertAssignment,
  randomDigits,
  signInAs,
  signToken,
  UNKNOWN_TEACHER_ID,
  uniqueName,
  uniquePhone,
} from "./helpers";

// These tests change students, so they only use the write teachers (see helpers).
const studentUrl = (id: string): string => `/api/students/${id}`;
const UNKNOWN_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";
const NOT_UUIDS: string[] = ["abc", "1", "null", "0198f0a2-7b3c", "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fzz"];
const NOT_FOUND_BODY = { error: ERROR_MESSAGES.studentNotFound };
const CLASS_NOT_FOUND_BODY = { error: ERROR_MESSAGES.classNotFound };

type TDto = { name: string; phone: string; classId: string };

// The second class of the write teacher: createStudent puts new students in the first one.
const secondClassId = async (request: APIRequestContext): Promise<string> => (await getClassList(request))[1].id;

const dtoFor = (classId: string, overrides: Partial<TDto> = {}): TDto => ({
  name: uniqueName(),
  phone: uniquePhone(),
  classId,
  ...overrides,
});

const findInList = async (request: APIRequestContext, id: string): Promise<TStudent | undefined> =>
  (await getStudentList(request)).find((student) => student.id === id);

// The student, as the list shows it, must still be exactly what it was.
const expectUnchanged = async (request: APIRequestContext, before: TStudent): Promise<void> => {
  expect(await findInList(request, before.id)).toEqual(before);
};

const otherTeacherContext = async (
  playwright: { request: { newContext: (options: { baseURL?: string }) => Promise<APIRequestContext> } },
  baseURL: string | undefined,
): Promise<APIRequestContext> => {
  const other = await playwright.request.newContext({ baseURL });
  await signInAs(other, WRITE_OTHER_SEED);
  return other;
};

test.describe("PUT /api/students/[id]: authorization", () => {
  const body = { name: "נועה כהן", phone: "050-1234567", classId: UNKNOWN_ID };

  test("returns 401 without a session", async ({ request }) => {
    const response = await request.put(studentUrl(UNKNOWN_ID), { data: body });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("checks the session before the id and the body: 401 even for a malformed id and an empty body", async ({
    request,
  }) => {
    expect((await request.put(studentUrl("abc"), { data: {} })).status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.put(studentUrl(UNKNOWN_ID), {
      data: body,
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.put(studentUrl(UNKNOWN_ID), {
      data: body,
      headers: { Cookie: `session=${token}` },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 again after logout, and changes nothing", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const student = await createStudent(request);
    await request.post("/api/auth/logout");

    const response = await request.put(studentUrl(student.id), { data: dtoFor(student.class.id) });

    expect(response.status()).toBe(401);
    await signInAs(request, WRITE_SEED);
    await expectUnchanged(request, student);
  });
});

test.describe("PUT /api/students/[id]: updating", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("replaces the name, the phone and the class, and answers with the student", async ({ request }) => {
    const student = await createStudent(request);
    const classId = await secondClassId(request);
    const dto = dtoFor(classId);

    const response = await request.put(studentUrl(student.id), { data: dto });

    expect(response.status()).toBe(200);
    const { student: updated } = await response.json();
    expect(updated).toEqual({
      id: student.id,
      name: dto.name,
      phone: dto.phone,
      class: { id: classId, name: expect.any(String) },
    });
    expect(updated.class.id).not.toBe(student.class.id);
  });

  test("the change shows in the list and in the student's own endpoint", async ({ request }) => {
    const student = await createStudent(request);
    const dto = dtoFor(await secondClassId(request));

    const { student: updated } = await (await request.put(studentUrl(student.id), { data: dto })).json();

    expect(await findInList(request, student.id)).toEqual(updated);
    expect((await (await request.get(studentUrl(student.id))).json()).student).toEqual(updated);
  });

  test("changes only that student", async ({ request }) => {
    const student = await createStudent(request);
    const neighbour = await createStudent(request);

    await request.put(studentUrl(student.id), { data: dtoFor(await secondClassId(request)) });

    await expectUnchanged(request, neighbour);
  });

  test("trims the name and saves the phone in one format", async ({ request }) => {
    const student = await createStudent(request);
    const name = uniqueName();
    const digits = randomDigits(7);

    const response = await request.put(studentUrl(student.id), {
      data: { name: `  ${name}  `, phone: `050${digits}`, classId: student.class.id },
    });

    expect(response.status()).toBe(200);
    const { student: updated } = await response.json();
    expect(updated.name).toBe(name);
    expect(updated.phone).toBe(`050-${digits}`);
  });

  test("sending the student's own values again is fine", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.put(studentUrl(student.id), {
      data: { name: student.name, phone: student.phone, classId: student.class.id },
    });

    expect(response.status()).toBe(200);
    expect((await response.json()).student).toEqual(student);
  });

  test("changing only the class keeps the name and the phone", async ({ request }) => {
    const student = await createStudent(request);
    const classId = await secondClassId(request);

    const response = await request.put(studentUrl(student.id), {
      data: { name: student.name, phone: student.phone, classId },
    });

    expect(response.status()).toBe(200);
    const { student: updated } = await response.json();
    expect(updated.name).toBe(student.name);
    expect(updated.phone).toBe(student.phone);
    expect(updated.class.id).toBe(classId);
  });

  test("keeps the student's assignments", async ({ request }) => {
    const student = await createStudent(request);
    await insertAssignment(student.id);

    await request.put(studentUrl(student.id), { data: dtoFor(student.class.id) });

    expect(await countAssignments(student.id)).toBe(1);
  });

  test("another teacher having a student with the same name and phone is fine", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const student = await createStudent(request);
    const other = await otherTeacherContext(playwright, baseURL);
    const dto = dtoFor((await getClassList(other))[0].id);
    expect((await other.post("/api/students", { data: dto })).status()).toBe(201);

    const response = await request.put(studentUrl(student.id), {
      data: { name: dto.name, phone: dto.phone, classId: student.class.id },
    });

    expect(response.status()).toBe(200);
    await other.dispose();
  });
});

test.describe("PUT /api/students/[id]: validation", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 400 for missing fields and for fields that are not strings, and changes nothing", async ({
    request,
  }) => {
    const student = await createStudent(request);

    for (const data of [{}, { name: 1, phone: 2, classId: 3 }, { name: null, phone: null, classId: null }]) {
      const response = await request.put(studentUrl(student.id), { data });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe(ERROR_MESSAGES.validation);
      expect(Object.keys(body.fields).sort()).toEqual(["classId", "name", "phone"]);
    }
    await expectUnchanged(request, student);
  });

  test("rejects an invalid phone, and changes nothing", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.put(studentUrl(student.id), {
      data: dtoFor(student.class.id, { phone: "12345" }),
    });

    expect(response.status()).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(["phone"]);
    await expectUnchanged(request, student);
  });

  test("rejects a name that is too short or has bad characters, and changes nothing", async ({ request }) => {
    const student = await createStudent(request);

    for (const name of ["א", "   ", "נועה123", "<script>"]) {
      const response = await request.put(studentUrl(student.id), {
        data: dtoFor(student.class.id, { name }),
      });

      expect(response.status()).toBe(400);
      expect(Object.keys((await response.json()).fields)).toEqual(["name"]);
    }
    await expectUnchanged(request, student);
  });

  test("rejects a class id that is not a uuid, and changes nothing", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.put(studentUrl(student.id), {
      data: dtoFor(student.class.id, { classId: "not-a-uuid" }),
    });

    expect(response.status()).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(["classId"]);
    await expectUnchanged(request, student);
  });

  test("returns 400 for a body that is not valid JSON", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.put(studentUrl(student.id), {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{not valid json"),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(ERROR_MESSAGES.invalidJson);
    await expectUnchanged(request, student);
  });

  test("an invalid body is a 400 even for an id that does not exist", async ({ request }) => {
    const response = await request.put(studentUrl(UNKNOWN_ID), { data: {} });

    expect(response.status()).toBe(400);
  });
});

test.describe("PUT /api/students/[id]: not found", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 404 for an id that does not exist", async ({ request }) => {
    const [firstClass] = await getClassList(request);

    const response = await request.put(studentUrl(UNKNOWN_ID), { data: dtoFor(firstClass.id) });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
  });

  for (const id of NOT_UUIDS) {
    test(`returns the same 404 for the id "${id}"`, async ({ request }) => {
      const [firstClass] = await getClassList(request);

      const response = await request.put(studentUrl(id), { data: dtoFor(firstClass.id) });

      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND_BODY);
    });
  }

  test("another teacher cannot update the student: the same 404, and nothing changes", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const student = await createStudent(request);
    const other = await otherTeacherContext(playwright, baseURL);
    const dto = dtoFor((await getClassList(other))[0].id);

    const response = await other.put(studentUrl(student.id), { data: dto });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
    await expectUnchanged(request, student);
    await other.dispose();
  });

  test("another teacher's class is not found, and nothing changes", async ({ request, playwright, baseURL }) => {
    const student = await createStudent(request);
    const other = await otherTeacherContext(playwright, baseURL);
    const otherClassId: string = (await getClassList(other))[0].id;

    const response = await request.put(studentUrl(student.id), { data: dtoFor(otherClassId) });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(CLASS_NOT_FOUND_BODY);
    await expectUnchanged(request, student);
    await other.dispose();
  });

  test("a class that does not exist is not found, and nothing changes", async ({ request }) => {
    const student = await createStudent(request);

    const response = await request.put(studentUrl(student.id), { data: dtoFor(UNKNOWN_ID) });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(CLASS_NOT_FOUND_BODY);
    await expectUnchanged(request, student);
  });

  test("the student is checked before the class", async ({ request }) => {
    const response = await request.put(studentUrl(UNKNOWN_ID), { data: dtoFor(UNKNOWN_ID) });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
  });

  test("a demo teacher's student cannot be reached by a write teacher", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const [demoStudent] = await getStudentList(request);
    await signInAs(request, WRITE_SEED);
    const [firstClass] = await getClassList(request);

    const response = await request.put(studentUrl(demoStudent.id), { data: dtoFor(firstClass.id) });

    expect(response.status()).toBe(404);
    await signInAs(request, DEMO_SEED);
    await expectUnchanged(request, demoStudent);
  });
});

test.describe("PUT /api/students/[id]: duplicates", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 409 when another of the teacher's students has that name and phone, and changes nothing", async ({
    request,
  }) => {
    const first = await createStudent(request);
    const second = await createStudent(request);

    const response = await request.put(studentUrl(second.id), {
      data: { name: first.name, phone: first.phone, classId: second.class.id },
    });

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentExists });
    await expectUnchanged(request, first);
    await expectUnchanged(request, second);
  });

  test("the same name with a different phone, or the same phone with a different name, is fine", async ({
    request,
  }) => {
    const first = await createStudent(request);
    const second = await createStudent(request);

    const sameName = await request.put(studentUrl(second.id), {
      data: { name: first.name, phone: uniquePhone(), classId: second.class.id },
    });
    const samePhone = await request.put(studentUrl(second.id), {
      data: { name: uniqueName(), phone: first.phone, classId: second.class.id },
    });

    expect(sameName.status()).toBe(200);
    expect(samePhone.status()).toBe(200);
  });

  test("two updates at the same moment to the same name and phone: one wins, the other gets 409", async ({
    request,
  }) => {
    const first = await createStudent(request);
    const second = await createStudent(request);
    const target = { name: uniqueName(), phone: uniquePhone() };

    const responses = await Promise.all(
      [first, second].map((student) =>
        request.put(studentUrl(student.id), { data: { ...target, classId: student.class.id } }),
      ),
    );

    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    const holders = (await getStudentList(request)).filter(
      ({ name, phone }) => name === target.name && phone === target.phone,
    );
    expect(holders).toHaveLength(1);
  });
});
