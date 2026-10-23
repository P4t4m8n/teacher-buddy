import { expect, test } from "@playwright/test";
import { TEACHER } from "./helpers";

test.describe("sign-in page", () => {
  test("shows the form", async ({ page }) => {
    await page.goto("/auth");

    await expect(page.getByLabel("שם")).toBeVisible();
    await expect(page.getByLabel("תעודת זהות")).toBeVisible();
    await expect(page.getByRole("button", { name: "התחברות" })).toBeVisible();
  });

  test("shows an error for wrong credentials and stays on the page", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill("987654321");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText("שם או תעודת זהות שגויים")).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("shows the server field errors under the inputs", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("שם").fill("   ");
    await page.getByLabel("תעודת זהות").fill("12");
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page.getByText("יש להזין שם")).toBeVisible();
    await expect(page.getByText("תעודת זהות חייבת להכיל 5-9 ספרות")).toBeVisible();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("signs in and goes to the dashboard", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === "session")).toBe(true);
  });

  test("replaces /auth in the history after signing in", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("שם").fill(TEACHER.name);
    await page.getByLabel("תעודת זהות").fill(TEACHER.idNumber);
    await page.getByRole("button", { name: "התחברות" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goBack();
    // Going back skips /auth, so the browser does not land on the sign-in form.
    await expect(page.getByRole("button", { name: "התחברות" })).toHaveCount(0);
  });
});
