import { expect, test } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { clientHeaders, TEACHER } from "./helpers";

const LOGIN_URL = "/api/auth/login";

test.describe("POST /api/auth/login", () => {
  test("returns 200, the teacher and a session cookie for valid credentials", async ({ request }) => {
    const response = await request.post(LOGIN_URL, { data: TEACHER });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.teacher.name).toBe(TEACHER.name);
    expect(body.teacher.id).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const setCookie = response.headers()["set-cookie"];
    expect(setCookie).toMatch(/^session=[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=86400/i);
    // COOKIE_SECURE is "false" for the test server, so Safari can store the cookie over http.
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });

  test("trims the name and the ID number before validating", async ({ request }) => {
    const response = await request.post(LOGIN_URL, {
      data: { name: `  ${TEACHER.name}  `, idNumber: ` ${TEACHER.idNumber} ` },
    });
    expect(response.status()).toBe(200);
  });

  test("returns 400 with field errors for invalid input", async ({ request }) => {
    const response = await request.post(LOGIN_URL, {
      data: { name: "   ", idNumber: "abc" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(ERROR_MESSAGES.validation);
    expect(body.fields.name).toBeDefined();
    expect(body.fields.idNumber).toBeDefined();
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("returns 400 when fields are missing or not strings", async ({ request }) => {
    const missing = await request.post(LOGIN_URL, { data: {} });
    expect(missing.status()).toBe(400);

    const wrongTypes = await request.post(LOGIN_URL, {
      data: { name: 123, idNumber: 123456789 },
    });
    expect(wrongTypes.status()).toBe(400);
  });

  test("returns 400 for a malformed JSON body", async ({ request }) => {
    const response = await request.post(LOGIN_URL, {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{not valid json"),
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe(ERROR_MESSAGES.invalidJson);
  });

  test("returns the same 401 for a wrong ID number and an unknown name, with no cookie", async ({ request }) => {
    // Failed tries are counted for the client address and the name, so this test is its own client.
    const headers = clientHeaders();
    const wrongId = await request.post(LOGIN_URL, {
      headers,
      data: { name: TEACHER.name, idNumber: "987654321" },
    });
    const unknownName = await request.post(LOGIN_URL, {
      headers,
      data: { name: "לא קיים", idNumber: TEACHER.idNumber },
    });

    expect(wrongId.status()).toBe(401);
    expect(unknownName.status()).toBe(401);
    expect(await wrongId.json()).toEqual({ error: ERROR_MESSAGES.invalidCredentials });
    expect(await unknownName.json()).toEqual({ error: ERROR_MESSAGES.invalidCredentials });
    expect(wrongId.headers()["set-cookie"]).toBeUndefined();
    expect(unknownName.headers()["set-cookie"]).toBeUndefined();
  });
});
