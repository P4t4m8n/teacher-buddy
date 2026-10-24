import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TStudent, TStudentClass } from "../types/student.type";
import {
  getStudentList,
  randomDigits,
  randomLetters,
  signInAs,
  signToken,
  UNKNOWN_TEACHER_ID,
  uniqueName,
  uniquePhone,
} from "./helpers";

const STUDENTS_URL = "/api/students";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// These tests create students in the shared test database with random names and phones (see helpers),
// so parallel tests and repeated runs never collide. They only use the write teachers, so the
// read-only tests that count the other teachers' rows are not affected.
type TWriteClasses = { first: TStudentClass; second: TStudentClass };

// The class ids are only discoverable through the seeded students, one per class.
const getWriteClasses = async (request: APIRequestContext): Promise<TWriteClasses> => {
  const classes = new Map<string, TStudentClass>(
    (await getStudentList(request)).map(({ class: studentClass }) => [studentClass.name, studentClass]),
  );
  const first = classes.get(WRITE_SEED.classes[0].name);
  const second = classes.get(WRITE_SEED.classes[1].name);
  if (!first || !second) throw new Error("The write teacher's classes are missing: reseed the test database");
  return { first, second };
};

const createStudent = (request: APIRequestContext, data: unknown): Promise<APIResponse> =>
  request.post(STUDENTS_URL, { data });

const namesIn = async (request: APIRequestContext): Promise<string[]> =>
  (await getStudentList(request)).map(({ name }) => name);

test.describe("POST /api/students: authorization", () => {
  const body = { name: uniqueName(), phone: uniquePhone(), classId: UNKNOWN_TEACHER_ID };

  test("returns 401 without a session", async ({ request }) => {
    const response = await createStudent(request, body);

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("checks the session before the body: 401 even for an invalid body", async ({ request }) => {
    const response = await createStudent(request, { name: "", phone: "", classId: "" });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.post(STUDENTS_URL, {
      data: body,
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.post(STUDENTS_URL, {
      data: body,
      headers: { Cookie: `session=${token}` },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 again after logout", async ({ request }) => {
    await signInAs(request, WRITE_SEED);
    const { first } = await getWriteClasses(request);
    await request.post("/api/auth/logout");

    const response = await createStudent(request, { ...body, classId: first.id });

    expect(response.status()).toBe(401);
  });
});

test.describe("POST /api/students: validation", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 400 with one message per invalid field", async ({ request }) => {
    const response = await createStudent(request, { name: "א", phone: "123", classId: "abc" });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(ERROR_MESSAGES.validation);
    expect(Object.keys(body.fields).sort()).toEqual(["classId", "name", "phone"]);
    for (const messages of Object.values<string[]>(body.fields)) {
      expect(messages).toHaveLength(1);
    }
  });

  test("returns 400 for missing fields and for fields that are not strings", async ({ request }) => {
    const missing = await createStudent(request, {});
    expect(missing.status()).toBe(400);
    expect(Object.keys((await missing.json()).fields).sort()).toEqual(["classId", "name", "phone"]);

    const wrongTypes = await createStudent(request, { name: 5, phone: 5, classId: 5 });
    expect(wrongTypes.status()).toBe(400);
  });

  test("returns 400 for a body that is not an object", async ({ request }) => {
    for (const data of [null, "text", 5, []]) {
      const response = await createStudent(request, data);
      expect(response.status(), JSON.stringify(data)).toBe(400);
    }
  });

  test("returns 400 for a malformed JSON body", async ({ request }) => {
    const response = await request.post(STUDENTS_URL, {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{not valid json"),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(ERROR_MESSAGES.invalidJson);
  });

  test("rejects an invalid phone and stores nothing", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();

    for (const phone of ["abc", "050-123456", "+972501234567", "050 1234567", ""]) {
      const response = await createStudent(request, { name, phone, classId: first.id });
      expect(response.status(), phone).toBe(400);
      expect(Object.keys((await response.json()).fields)).toEqual(["phone"]);
    }

    expect(await namesIn(request)).not.toContain(name);
  });

  test("rejects markup and digits in the name", async ({ request }) => {
    const { first } = await getWriteClasses(request);

    for (const name of ["<script>alert(1)</script>", "<b>דנה</b>", "דנה 123", "דנה@לוי"]) {
      const response = await createStudent(request, { name, phone: uniquePhone(), classId: first.id });
      expect(response.status(), name).toBe(400);
      expect(Object.keys((await response.json()).fields)).toEqual(["name"]);
    }

    expect(await namesIn(request)).not.toContain("<script>alert(1)</script>");
  });

  test("rejects a class id that is not a uuid, like an integer id", async ({ request }) => {
    for (const classId of ["1", "abc", "", "0198f0a2-7b3c"]) {
      const response = await createStudent(request, { name: uniqueName(), phone: uniquePhone(), classId });
      expect(response.status(), classId).toBe(400);
      expect(Object.keys((await response.json()).fields)).toEqual(["classId"]);
    }
  });
});

test.describe("POST /api/students: creating", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 201 with the new student and its class", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const body = { name: uniqueName(), phone: uniquePhone(), classId: first.id };

    const response = await createStudent(request, body);

    expect(response.status()).toBe(201);
    const { student } = await response.json();
    expect(student).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      name: body.name,
      phone: body.phone,
      class: { id: first.id, name: first.name },
    });
  });

  test("the new student shows up in the list, in the chosen class", async ({ request }) => {
    const { second } = await getWriteClasses(request);
    const body = { name: uniqueName(), phone: uniquePhone(), classId: second.id };

    const created: TStudent = (await (await createStudent(request, body)).json()).student;

    const found = (await getStudentList(request)).find(({ id }) => id === created.id);
    expect(found).toEqual(created);
    expect(found?.class.name).toBe(WRITE_SEED.classes[1].name);
  });

  test("trims the name and the phone before storing them", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();
    const phone = uniquePhone();

    const response = await createStudent(request, {
      name: `   ${name}   `,
      phone: `  ${phone}  `,
      classId: first.id,
    });

    expect(response.status()).toBe(201);
    const { student } = await response.json();
    expect(student.name).toBe(name);
    expect(student.phone).toBe(phone);
  });

  test("saves the phone in one format, however it was typed", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const digits = randomDigits(7);
    const cases: [string, string][] = [
      [`050${digits}`, `050-${digits}`],
      [`050-${digits}`, `050-${digits}`],
      [`072${digits}`, `072-${digits}`],
      [`03${digits}`, `03-${digits}`],
      [`03-${digits}`, `03-${digits}`],
      [`  050${digits}  `, `050-${digits}`],
    ];

    for (const [typed, saved] of cases) {
      const response = await createStudent(request, { name: uniqueName(), phone: typed, classId: first.id });
      expect(response.status(), typed).toBe(201);
      expect((await response.json()).student.phone, typed).toBe(saved);
    }
  });

  test("the list shows the saved format of a phone typed without a hyphen", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();
    const digits = randomDigits(7);

    await createStudent(request, { name, phone: `050${digits}`, classId: first.id });

    const found = (await getStudentList(request)).find((student) => student.name === name);
    expect(found?.phone).toBe(`050-${digits}`);
  });

  test("accepts the shortest and the longest name", async ({ request }) => {
    const { first } = await getWriteClasses(request);

    for (const name of [randomLetters(2), randomLetters(60)]) {
      const response = await createStudent(request, { name, phone: uniquePhone(), classId: first.id });
      expect(response.status(), name).toBe(201);
    }
  });

  test("accepts Hebrew names with a space, a hyphen and a geresh", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const suffix = randomLetters(8);

    for (const name of [`בן-דוד ${suffix}`, `ג'ורג' ${suffix}`, `דנה בן דוד ${suffix}`]) {
      const response = await createStudent(request, { name, phone: uniquePhone(), classId: first.id });
      expect(response.status(), name).toBe(201);
      expect((await response.json()).student.name).toBe(name);
    }
  });

  test("allows the same name with a different phone, and the same phone with a different name", async ({
    request,
  }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();
    const phone = uniquePhone();
    expect((await createStudent(request, { name, phone, classId: first.id })).status()).toBe(201);

    const sameNameOtherPhone = await createStudent(request, { name, phone: uniquePhone(), classId: first.id });
    const samePhoneOtherName = await createStudent(request, { name: uniqueName(), phone, classId: first.id });

    expect(sameNameOtherPhone.status()).toBe(201);
    expect(samePhoneOtherName.status()).toBe(201);
  });

  test("ignores a teacherId or an id in the body: the student belongs to the signed-in teacher", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const { first } = await getWriteClasses(request);
    const demo = await playwright.request.newContext({ baseURL });
    await signInAs(demo, DEMO_SEED);
    const demoTeacherId: string = (await (await demo.get("/api/auth/me")).json()).teacher.id;
    const chosenId = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f99";
    const name = uniqueName();

    const response = await createStudent(request, {
      name,
      phone: uniquePhone(),
      classId: first.id,
      teacherId: demoTeacherId,
      id: chosenId,
    });

    expect(response.status()).toBe(201);
    expect((await response.json()).student.id).not.toBe(chosenId);
    expect(await namesIn(request)).toContain(name);
    expect(await namesIn(demo)).not.toContain(name);
    await demo.dispose();
  });
});

test.describe("POST /api/students: class not found", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 404 for a class that does not exist, and stores nothing", async ({ request }) => {
    const name = uniqueName();

    const response = await createStudent(request, {
      name,
      phone: uniquePhone(),
      classId: UNKNOWN_TEACHER_ID,
    });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.classNotFound });
    expect(await namesIn(request)).not.toContain(name);
  });

  test("returns the same 404 for another teacher's class, so ids cannot be probed", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const demo = await playwright.request.newContext({ baseURL });
    await signInAs(demo, DEMO_SEED);
    const demoClass: TStudentClass = (await getStudentList(demo))[0].class;
    const name = uniqueName();

    const response = await createStudent(request, { name, phone: uniquePhone(), classId: demoClass.id });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.classNotFound });
    expect(await namesIn(request)).not.toContain(name);
    expect(await namesIn(demo)).not.toContain(name);
    await demo.dispose();
  });
});

test.describe("POST /api/students: duplicates", () => {
  test.beforeEach(async ({ request }) => {
    await signInAs(request, WRITE_SEED);
  });

  test("returns 409 for the same name and phone, and stores only the first", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const body = { name: uniqueName(), phone: uniquePhone(), classId: first.id };
    expect((await createStudent(request, body)).status()).toBe(201);

    const response = await createStudent(request, body);

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.studentExists });
    expect((await namesIn(request)).filter((name) => name === body.name)).toHaveLength(1);
  });

  test("returns 409 when the same phone is written in another format", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();
    const digits = randomDigits(7);
    expect(
      (await createStudent(request, { name, phone: `050-${digits}`, classId: first.id })).status(),
    ).toBe(201);

    const response = await createStudent(request, { name, phone: `050${digits}`, classId: first.id });

    expect(response.status()).toBe(409);
  });

  test("returns 409 for the same student in another class, since duplicates are per teacher", async ({
    request,
  }) => {
    const { first, second } = await getWriteClasses(request);
    const name = uniqueName();
    const phone = uniquePhone();
    expect((await createStudent(request, { name, phone, classId: first.id })).status()).toBe(201);

    const response = await createStudent(request, { name, phone, classId: second.id });

    expect(response.status()).toBe(409);
  });

  test("identical requests at the same moment: exactly one is created, the rest get 409", async ({
    request,
  }) => {
    const { first } = await getWriteClasses(request);
    const body = { name: uniqueName(), phone: uniquePhone(), classId: first.id };

    const responses = await Promise.all(Array.from({ length: 8 }, () => createStudent(request, body)));

    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
    expect((await namesIn(request)).filter((name) => name === body.name)).toHaveLength(1);
  });

  test("the same phone typed two ways at the same moment is still one student", async ({ request }) => {
    const { first } = await getWriteClasses(request);
    const name = uniqueName();
    const digits = randomDigits(7);

    const responses = await Promise.all([
      createStudent(request, { name, phone: `050-${digits}`, classId: first.id }),
      createStudent(request, { name, phone: `050${digits}`, classId: first.id }),
      createStudent(request, { name, phone: `050-${digits}`, classId: first.id }),
      createStudent(request, { name, phone: `050${digits}`, classId: first.id }),
    ]);

    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);
    expect((await namesIn(request)).filter((studentName) => studentName === name)).toHaveLength(1);
  });

  test("different students at the same moment are all created", async ({ request }) => {
    const { first } = await getWriteClasses(request);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        createStudent(request, { name: uniqueName(), phone: uniquePhone(), classId: first.id }),
      ),
    );

    expect(responses.map((response) => response.status())).toEqual([201, 201, 201, 201, 201]);
  });

  test("two teachers can each have a student with the same name and phone", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const { first } = await getWriteClasses(request);
    const second = await playwright.request.newContext({ baseURL });
    await signInAs(second, WRITE_OTHER_SEED);
    const secondClass: TStudentClass = (await getStudentList(second))[0].class;
    const name = uniqueName();
    const phone = uniquePhone();

    const mine = await createStudent(request, { name, phone, classId: first.id });
    const theirs = await createStudent(second, { name, phone, classId: secondClass.id });

    expect(mine.status()).toBe(201);
    expect(theirs.status()).toBe(201);
    await second.dispose();
  });
});
