import { expect, test } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import { getStudentList, signInAs, signToken, UNKNOWN_TEACHER_ID } from "./helpers";

const STUDENTS_URL = "/api/students";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// What the seed says each teacher's students look like: name -> { phone, class name }.
const expectedStudents = (seed: TSeedTeacher): Record<string, { phone: string; className: string }> =>
  Object.fromEntries(
    seed.classes.flatMap(({ name: className, students }) =>
      students.map(({ name, phone }) => [name, { phone, className }]),
    ),
  );

test.describe("GET /api/students: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get(STUDENTS_URL);

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.get(STUDENTS_URL, {
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.get(STUDENTS_URL, { headers: { Cookie: `session=${token}` } });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 again after logout", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    expect((await request.get(STUDENTS_URL)).status()).toBe(200);

    await request.post("/api/auth/logout");

    expect((await request.get(STUDENTS_URL)).status()).toBe(401);
  });
});

test.describe("GET /api/students: data", () => {
  test("returns all of the signed-in teacher's students with their class", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const students = await getStudentList(request);

    const expected = expectedStudents(DEMO_SEED);
    expect(students).toHaveLength(Object.keys(expected).length);
    for (const student of students) {
      const seeded = expected[student.name];
      expect(seeded, `unexpected student ${student.name}`).toBeDefined();
      expect(student.phone).toBe(seeded.phone);
      expect(student.class.name).toBe(seeded.className);
    }
  });

  test("returns only the expected fields, with uuid ids", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const students = await getStudentList(request);

    for (const student of students) {
      expect(Object.keys(student).sort()).toEqual(["class", "id", "name", "phone"]);
      expect(Object.keys(student.class).sort()).toEqual(["id", "name"]);
      expect(student.id).toMatch(UUID_PATTERN);
      expect(student.class.id).toMatch(UUID_PATTERN);
    }
  });

  test("students of the same class share the same class id", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const students = await getStudentList(request);

    const classIdByName = new Map<string, string>();
    for (const { class: studentClass } of students) {
      const known = classIdByName.get(studentClass.name);
      if (known) expect(studentClass.id).toBe(known);
      classIdByName.set(studentClass.name, studentClass.id);
    }
    // The seeded class without students does not show up, only classes that have students do.
    const classesWithStudents = DEMO_SEED.classes.filter(({ students: list }) => list.length > 0);
    expect(classIdByName.size).toBe(classesWithStudents.length);
  });

  test("a teacher never sees another teacher's students", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const demoNames = (await getStudentList(request)).map(({ name }) => name);

    await signInAs(request, OTHER_SEED);
    const otherStudents = await getStudentList(request);
    const otherNames = otherStudents.map(({ name }) => name);

    const otherExpected = expectedStudents(OTHER_SEED);
    expect([...otherNames].sort()).toEqual(Object.keys(otherExpected).sort());
    expect(otherNames.filter((name) => demoNames.includes(name))).toEqual([]);
  });

  test("the response is not cached between teachers", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const first = await getStudentList(request);

    await signInAs(request, OTHER_SEED);
    const second = await getStudentList(request);

    expect(second.map(({ id }) => id)).not.toEqual(first.map(({ id }) => id));
  });
});
