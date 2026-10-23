import { expect, test } from "@playwright/test";
import { signToken, TEACHER, UNKNOWN_TEACHER_ID } from "./helpers";

const ME_URL = "/api/auth/me";

test.describe("GET /api/auth/me", () => {
  test("returns the signed-in teacher", async ({ request }) => {
    const login = await request.post("/api/auth/login", { data: TEACHER });
    const { teacher: loggedIn } = await login.json();

    const response = await request.get(ME_URL);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ teacher: { id: loggedIn.id, name: TEACHER.name } });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get(ME_URL);

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 for a forged cookie", async ({ request }) => {
    const response = await request.get(ME_URL, {
      headers: { Cookie: "session=forged.token.value" },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 for an expired token", async ({ request }) => {
    const aMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    const token = await signToken(UNKNOWN_TEACHER_ID, aMinuteAgo);

    const response = await request.get(ME_URL, { headers: { Cookie: `session=${token}` } });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for a valid token of a teacher that does not exist", async ({ request }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");

    const response = await request.get(ME_URL, { headers: { Cookie: `session=${token}` } });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 after logout", async ({ request }) => {
    await request.post("/api/auth/login", { data: TEACHER });
    expect((await request.get(ME_URL)).status()).toBe(200);

    await request.post("/api/auth/logout");

    expect((await request.get(ME_URL)).status()).toBe(401);
  });
});
