import { expect, test, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { gotoHydrated, TEACHER } from "./helpers";

const signInWithForm = async (page: Page): Promise<void> => {
  await gotoHydrated(page, "/auth");
  await page.getByLabel("שם").fill(TEACHER.name);
  await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
  await page.getByRole("button", { name: "התחברות" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

const hasSessionCookie = async (page: Page): Promise<boolean> => {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === "session");
};

test.describe("sign-in flow", () => {
  test("form sign-in, stay signed in, sign out", async ({ page }) => {
    // An anonymous visitor to the root ends up on the sign-in page.
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth$/);

    await signInWithForm(page);
    await expect(page.getByRole("heading", { name: "לוח בקרה" })).toBeVisible();
    await expect(page.getByRole("button", { name: "התנתקות" })).toBeVisible();
    expect(await hasSessionCookie(page)).toBe(true);

    // The session survives a reload, and the sign-in page and the root send the user to the dashboard.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/auth");
    await expect(page).toHaveURL(/\/dashboard$/);
    await gotoHydrated(page, "/");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "התנתקות" }).click();
    await expect(page).toHaveURL(/\/auth$/);
    expect(await hasSessionCookie(page)).toBe(false);

    // After signing out, the dashboard is protected again.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("demo sign-in, then sign out", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "התנתקות" }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("button", { name: "כניסה עם מורה לדוגמה" })).toBeVisible();
  });

  test("a failed sign-in can be corrected and retried", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page.getByText("שם או תעודת זהות שגויים")).toBeVisible();

    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the server's error when the server fails", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.internal }),
      }),
    );

    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("shows an error when signing out fails and stays on the dashboard", async ({ page }) => {
    await signInWithForm(page);
    await page.route("**/api/auth/logout", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.internal }),
      }),
    );

    await page.getByRole("button", { name: "התנתקות" }).click();

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("error messages come from the server", () => {
  test("shows exactly the message the server sends, whatever the status", async ({ page }) => {
    const serverMessage = "הודעת בדיקה שנשלחה מהשרת";
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: serverMessage }),
      }),
    );

    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page.getByText(serverMessage)).toBeVisible();
  });

  test("wrong credentials show the server's Hebrew message from the real API", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText(ERROR_MESSAGES.invalidCredentials)).toBeVisible();
  });

  test("shows the network message when the request gets no answer, and can be retried", async ({ page }) => {
    let failNext = true;
    await page.route("**/api/auth/login", (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });

    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();
    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);

    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the generic message when the error page is not JSON", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<html><body>Bad gateway</body></html>",
      }),
    );

    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page.getByText("Bad gateway")).toHaveCount(0);
  });

  test("a failed sign-out with no connection shows the network message and stays on the dashboard", async ({
    page,
  }) => {
    await signInWithForm(page);
    await page.route("**/api/auth/logout", (route) => route.abort("failed"));

    await page.getByRole("button", { name: "התנתקות" }).click();

    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the previous error is cleared when the next attempt starts", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page.getByText(ERROR_MESSAGES.invalidCredentials)).toBeVisible();

    // The next attempt fails validation instead: the old message is gone and the field error shows.
    await page.getByLabel("תעודת זהות").fill("12");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText("תעודת זהות חייבת להכיל 5-9 ספרות")).toBeVisible();
    await expect(page.getByText(ERROR_MESSAGES.invalidCredentials)).toHaveCount(0);
  });
});
