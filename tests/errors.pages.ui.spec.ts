import { expect, test } from "@playwright/test";
import { DEMO_SEED } from "../prisma/seed-data";
import { signInAs } from "./helpers";

// Pages that only read, so the demo teacher is safe.
const NOT_FOUND_TITLE = "העמוד לא נמצא";

test.describe("the app-level not-found page", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
  });

  test("an address that does not exist shows it, with a 404 status", async ({ page }) => {
    const response = await page.goto("/no-such-page");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: NOT_FOUND_TITLE, level: 1 })).toBeVisible();
    await expect(page.getByText("הכתובת שהזנתם אינה קיימת, או שהעמוד הוסר.")).toBeVisible();
  });

  test("a deeper address under the dashboard shows it too", async ({ page }) => {
    const response = await page.goto("/dashboard/nothing/here");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: NOT_FOUND_TITLE, level: 1 })).toBeVisible();
  });

  test("the way out leads to the dashboard", async ({ page }) => {
    await page.goto("/no-such-page");

    await page.getByRole("link", { name: "חזרה ללוח הבקרה" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toBeVisible();
  });

  test("is in Hebrew, right to left, with the page title of the app", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page).toHaveTitle(/Teacher Buddy/);
  });

  test("tells search engines not to index it", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the pages that have their own not-found message keep it", async ({ page }) => {
    await page.goto("/dashboard/students/0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60");
    await expect(page.getByRole("heading", { name: "התלמיד לא נמצא" })).toBeVisible();

    await page.goto("/dashboard/assignments/0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60");
    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
  });
});

test.describe("the app-level not-found page: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("fits the screen, and the button can be used", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await page.goto("/no-such-page");

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole("link", { name: "חזרה ללוח הבקרה" })).toBeInViewport();
  });
});

test.describe("the app-level not-found page: without a session", () => {
  test("goes to the sign-in page first, so nothing about the app is shown", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page).toHaveURL(/\/auth$/);
  });
});
