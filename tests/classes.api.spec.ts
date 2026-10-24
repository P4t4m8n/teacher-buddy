import { expect, test, type APIRequestContext } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, OTHER_SEED, WRITE_SEED, type TSeedTeacher } from "../prisma/seed-data";
import type { TClass } from "../types/class.type";
import { getStudentList, signInAs, signToken, UNKNOWN_TEACHER_ID } from "./helpers";

const CLASSES_URL = "/api/classes";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const classNamesOf = (seed: TSeedTeacher): string[] => seed.classes.map(({ name }) => name);

const getClassList = async (request: APIRequestContext): Promise<TClass[]> => {
  const response = await request.get(CLASSES_URL);
  expect(response.status()).toBe(200);
  return (await response.json()).classes;
};

test.describe("GET /api/classes: authorization", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get(CLASSES_URL);

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.get(CLASSES_URL, {
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.get(CLASSES_URL, { headers: { Cookie: `session=${token}` } });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: ERROR_MESSAGES.unauthorized });
  });

  test("returns 401 again after logout", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    expect((await request.get(CLASSES_URL)).status()).toBe(200);

    await request.post("/api/auth/logout");

    expect((await request.get(CLASSES_URL)).status()).toBe(401);
  });

  test("only allows GET", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    for (const response of [
      await request.post(CLASSES_URL, { data: { name: "ח'9" } }),
      await request.put(CLASSES_URL, { data: {} }),
      await request.delete(CLASSES_URL),
    ]) {
      expect(response.status()).toBe(405);
    }
  });
});

test.describe("GET /api/classes: data", () => {
  test("returns all of the signed-in teacher's classes, sorted by name", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const classes = await getClassList(request);

    expect(classes.map(({ name }) => name)).toEqual(classNamesOf(DEMO_SEED));
  });

  test("includes a class that has no students", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const emptyClassName = DEMO_SEED.classes.find(({ students }) => students.length === 0)?.name;

    const classes = await getClassList(request);

    expect(emptyClassName).toBeDefined();
    expect(classes.map(({ name }) => name)).toContain(emptyClassName);
    const withStudents = new Set((await getStudentList(request)).map(({ class: { name } }) => name));
    expect(withStudents.has(emptyClassName as string)).toBe(false);
  });

  test("returns only id and name, with uuid ids", async ({ request }) => {
    await signInAs(request, DEMO_SEED);

    const classes = await getClassList(request);

    for (const studentClass of classes) {
      expect(Object.keys(studentClass).sort()).toEqual(["id", "name"]);
      expect(studentClass.id).toMatch(UUID_PATTERN);
    }
    expect(new Set(classes.map(({ id }) => id)).size).toBe(classes.length);
  });

  test("the ids match the classes of the students list, so a student can be added to any of them", async ({
    request,
  }) => {
    await signInAs(request, DEMO_SEED);

    const classes = await getClassList(request);
    const classById = new Map(classes.map(({ id, name }) => [id, name]));

    for (const { class: studentClass } of await getStudentList(request)) {
      expect(classById.get(studentClass.id)).toBe(studentClass.name);
    }
  });

  test("a teacher never sees another teacher's classes", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const demoClasses = await getClassList(request);

    await signInAs(request, OTHER_SEED);
    const otherClasses = await getClassList(request);

    expect(otherClasses.map(({ name }) => name)).toEqual(classNamesOf(OTHER_SEED));
    const demoIds = new Set(demoClasses.map(({ id }) => id));
    expect(otherClasses.filter(({ id }) => demoIds.has(id))).toEqual([]);
  });

  test("the response is not cached between teachers", async ({ request }) => {
    await signInAs(request, DEMO_SEED);
    const first = await getClassList(request);

    await signInAs(request, WRITE_SEED);
    const second = await getClassList(request);

    expect(second.map(({ id }) => id)).not.toEqual(first.map(({ id }) => id));
    expect(second.map(({ name }) => name)).toEqual(classNamesOf(WRITE_SEED));
  });
});
