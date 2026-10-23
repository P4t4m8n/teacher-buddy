import { expect, test } from "@playwright/test";
import { TEACHER } from "./helpers";

const LOGIN_URL = "/api/auth/login";
const LOGOUT_URL = "/api/auth/logout";

test.describe("POST /api/auth/logout", () => {
  test("returns 200 and expires the session cookie", async ({ request }) => {
    const response = await request.post(LOGOUT_URL);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ message: "Signed out" });

    const setCookie = response.headers()["set-cookie"];
    expect(setCookie).toMatch(/^session=;/);
    expect(setCookie).toMatch(/Max-Age=0/i);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//i);
  });

  test("removes the session cookie that login set", async ({ request }) => {
    const login = await request.post(LOGIN_URL, { data: TEACHER });
    expect(login.status()).toBe(200);

    const before = (await request.storageState()).cookies;
    expect(before.some((cookie) => cookie.name === "session")).toBe(true);

    const logout = await request.post(LOGOUT_URL);
    expect(logout.status()).toBe(200);

    const after = (await request.storageState()).cookies;
    expect(after.some((cookie) => cookie.name === "session")).toBe(false);
  });

  test("works without a session (calling it twice is safe)", async ({ request }) => {
    const first = await request.post(LOGOUT_URL);
    const second = await request.post(LOGOUT_URL);

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
  });
});
