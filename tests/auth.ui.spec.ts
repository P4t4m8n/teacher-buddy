import { expect, test } from "@playwright/test";
import { clientHeaders, gotoHydrated, TEACHER } from "./helpers";

test.describe("sign-in page", () => {
  test("shows the form", async ({ page }) => {
    await page.goto("/auth");

    await expect(page.getByLabel("שם")).toBeVisible();
    await expect(page.getByLabel("תעודת זהות")).toBeVisible();
    await expect(page.getByRole("button", { name: "התחברות" })).toBeVisible();
    await expect(page.getByRole("button", { name: "כניסה עם מורה לדוגמה" })).toBeVisible();
  });

  test("does not show the logout button", async ({ page }) => {
    await page.goto("/auth");

    await expect(page.getByRole("button", { name: "התנתקות" })).toHaveCount(0);
  });

  test("signs in with the demo teacher button", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByRole("button", { name: "כניסה עם מורה לדוגמה" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "session")).toBe(true);
  });

  test("shows an error for wrong credentials and stays on the page", async ({ page }) => {
    await page.setExtraHTTPHeaders(clientHeaders());
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText("שם או תעודת זהות שגויים")).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("shows the server field errors under the inputs", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill("   ");
    await page.getByLabel("תעודת זהות").fill("12");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText("יש להזין שם")).toBeVisible();
    await expect(page.getByText("תעודת זהות חייבת להכיל 5-9 ספרות")).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("signs in and goes to the dashboard", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "session")).toBe(true);
  });

  test("replaces /auth in the history after signing in", async ({ page }) => {
    await gotoHydrated(page, "/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goBack();
    // Going back skips /auth, so the browser does not land on the sign-in form.
    await expect(page.getByRole("button", { name: "התחברות" })).toHaveCount(0);
  });
});

test.describe("theme", () => {
  const BACKGROUND_COLOR = {
    light: "rgb(248, 250, 252)",
    dark: "rgb(2, 6, 23)",
  };

  for (const scheme of ["light", "dark"] as const) {
    test(`follows the system ${scheme} color scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/auth");

      await expect(page.locator("body")).toHaveCSS("background-color", BACKGROUND_COLOR[scheme]);
    });
  }

  test("uses a different card background in dark mode", async ({ page }) => {
    const readCardBackground = async (scheme: "light" | "dark"): Promise<string> => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/auth");
      const card = page.getByRole("heading", { name: "ברוכים הבאים" }).locator("..");
      return card.evaluate((element) => getComputedStyle(element).backgroundColor);
    };

    const light = await readCardBackground("light");
    const dark = await readCardBackground("dark");

    expect(dark).not.toBe(light);
  });
});
