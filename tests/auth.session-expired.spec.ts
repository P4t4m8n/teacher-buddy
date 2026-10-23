import { expect, test, type Page } from "@playwright/test";
import { gotoHydrated, redirectPath, signToken, TEACHER, UNKNOWN_TEACHER_ID } from "./helpers";

const hasSessionCookie = async (page: Page): Promise<boolean> => {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === "session");
};

test.describe("GET /api/auth/session-expired", () => {
  test("clears the cookie and redirects to /auth, even without a session", async ({ request }) => {
    const response = await request.get("/api/auth/session-expired", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(redirectPath(response)).toBe("/auth");
    expect(response.headers()["set-cookie"]).toMatch(/^session=;/);
    expect(response.headers()["set-cookie"]).toMatch(/Max-Age=0/i);
  });
});

test.describe("dashboard session check", () => {
  test("shows the signed-in teacher's name", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("header").getByText(TEACHER.name)).toBeVisible();
  });

  test("a valid token of a deleted teacher ends on /auth with the cookie cleared (no redirect loop)", async ({
    page,
    baseURL,
  }) => {
    // Passes the proxy (valid signature, not expired) but getSessionTeacher() finds no teacher.
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");
    await page.context().addCookies([{ name: "session", value: token, url: baseURL }]);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("button", { name: "התחברות" })).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(false);

    // The proxy now sees no session, so /dashboard goes to /auth instead of looping.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("the teacher can sign in again after the stale session was cleared", async ({ page, baseURL }) => {
    const token = await signToken(UNKNOWN_TEACHER_ID, "1h");
    await page.context().addCookies([{ name: "session", value: token, url: baseURL }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth$/);

    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("header").getByText(TEACHER.name)).toBeVisible();
  });
});
