import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_SEED } from "../prisma/seed-data";
import type { TStudent } from "../types/student.type";
import { getClassList, getStudentList, gotoHydrated, signInAs, uniqueName, uniquePhone } from "./helpers";

// These tests delete students, so they only use a write teacher and only delete students they created
// themselves (see helpers).
const DASHBOARD_URL = "/dashboard";
const CONFIRM_TITLE = "מחיקת תלמיד";
const NOT_FOUND_MESSAGE = ERROR_MESSAGES.studentNotFound;

// The list updates through router.refresh(), a request to the dev server. When many tests run at once
// it can take longer than the default 5 seconds, so the checks that wait for it are given more time.
const REFRESH = { timeout: 20_000 };

const createStudent = async (page: Page): Promise<TStudent> => {
  const [firstClass] = await getClassList(page.request);
  const response = await page.request.post("/api/students", {
    data: { name: uniqueName(), phone: uniquePhone(), classId: firstClass.id },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).student;
};

const exists = async (page: Page, student: TStudent): Promise<boolean> =>
  (await getStudentList(page.request)).some(({ id }) => id === student.id);

const studentRow = (page: Page, student: TStudent): Locator =>
  page.locator("tbody tr").filter({ hasText: student.name });

const deleteButton = (page: Page, student: TStudent): Locator =>
  page.getByRole("button", { name: `מחיקה עבור ${student.name}` });

const confirmDialog = (page: Page): Locator => page.getByRole("dialog", { name: CONFIRM_TITLE });

const deleteUrl = (student: TStudent): string => `**/api/students/${student.id}`;

// Answers only the DELETE request, so the page can still load the student normally.
const interceptDelete = (page: Page, student: TStudent, handler: (route: Route) => Promise<void> | void) =>
  page.route(deleteUrl(student), (route: Route) =>
    route.request().method() === "DELETE" ? handler(route) : route.fallback(),
  );

const openDashboard = async (page: Page): Promise<TStudent> => {
  await signInAs(page.request, WRITE_SEED);
  const student: TStudent = await createStudent(page);
  await gotoHydrated(page, DASHBOARD_URL);
  await expect(studentRow(page, student)).toBeVisible();
  return student;
};

test.describe("delete student: wide screen", () => {
  test("the delete button asks for confirmation first, and deletes nothing yet", async ({ page }) => {
    const student: TStudent = await openDashboard(page);

    await deleteButton(page, student).click();

    const dialog: Locator = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(student.name);
    await expect(dialog).toContainText("המטלות והציונים");
    expect(await exists(page, student)).toBe(true);
    await expect(studentRow(page, student)).toBeVisible();
  });

  test("cancel closes it and keeps the student", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await deleteButton(page, student).click();

    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await expect(confirmDialog(page)).toBeHidden();
    expect(await exists(page, student)).toBe(true);
    await expect(studentRow(page, student)).toBeVisible();
  });

  test("Escape closes it and keeps the student", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await deleteButton(page, student).click();
    await expect(confirmDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(confirmDialog(page)).toBeHidden();
    expect(await exists(page, student)).toBe(true);
  });

  test("confirming deletes the student, closes the dialog and removes the row", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await deleteButton(page, student).click();

    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();

    await expect(confirmDialog(page)).toBeHidden();
    await expect.poll(() => exists(page, student)).toBe(false);
    await expect(studentRow(page, student)).toHaveCount(0, REFRESH);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("deletes only that student", async ({ page }) => {
    const first: TStudent = await openDashboard(page);
    const second: TStudent = await createStudent(page);
    await page.reload();
    await expect(studentRow(page, second)).toBeVisible();

    await deleteButton(page, first).click();
    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();

    await expect(studentRow(page, first)).toHaveCount(0, REFRESH);
    await expect(studentRow(page, second)).toBeVisible();
    expect(await exists(page, second)).toBe(true);
  });

  test("while deleting, the buttons are disabled and it says so", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await interceptDelete(page, student, async (route) => {
      await released;
      await route.continue();
    });
    await deleteButton(page, student).click();
    const dialog: Locator = confirmDialog(page);

    await dialog.getByRole("button", { name: "מחיקה" }).click();

    await expect(dialog.getByRole("button", { name: "מוחק..." })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "ביטול" })).toBeDisabled();

    release();
    await expect(studentRow(page, student)).toHaveCount(0, REFRESH);
  });

  test("shows the server's message, keeps the dialog and the student, and can be retried", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await interceptDelete(page, student, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: NOT_FOUND_MESSAGE }),
      }),
    );
    await deleteButton(page, student).click();
    const dialog: Locator = confirmDialog(page);

    await dialog.getByRole("button", { name: "מחיקה" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(NOT_FOUND_MESSAGE);
    await expect(dialog.getByRole("button", { name: "מחיקה" })).toBeEnabled();
    expect(await exists(page, student)).toBe(true);

    await page.unroute(deleteUrl(student));
    await dialog.getByRole("button", { name: "מחיקה" }).click();

    await expect(studentRow(page, student)).toHaveCount(0, REFRESH);
    expect(await exists(page, student)).toBe(false);
  });

  test("shows the network message when the server cannot be reached", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await interceptDelete(page, student, (route) => route.abort());
    await deleteButton(page, student).click();

    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();

    await expect(confirmDialog(page).getByRole("alert")).toHaveText(ERROR_MESSAGES.network);
    expect(await exists(page, student)).toBe(true);
  });

  test("an error is gone the next time the dialog opens", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await interceptDelete(page, student, (route) => route.abort());
    await deleteButton(page, student).click();
    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();
    await expect(confirmDialog(page).getByRole("alert")).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await deleteButton(page, student).click();

    await expect(confirmDialog(page)).toBeVisible();
    await expect(confirmDialog(page).getByRole("alert")).toHaveCount(0);
  });

  test("when the student was already deleted elsewhere, it shows the message", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await deleteButton(page, student).click();
    expect((await page.request.delete(`/api/students/${student.id}`)).status()).toBe(200);

    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();

    await expect(confirmDialog(page).getByRole("alert")).toHaveText(NOT_FOUND_MESSAGE);
  });
});

test.describe("delete student: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("deleting confirms, deletes and removes the row", async ({ page }) => {
    const student: TStudent = await openDashboard(page);

    await deleteButton(page, student).click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "מחיקה" }).click();

    await expect(studentRow(page, student)).toHaveCount(0, REFRESH);
    expect(await exists(page, student)).toBe(false);
    await expect(page.getByRole("dialog")).toHaveCount(0, REFRESH);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("the confirm dialog fits the screen, and cancelling keeps the student", async ({ page }) => {
    const student: TStudent = await openDashboard(page);
    await deleteButton(page, student).click();

    const box = await confirmDialog(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await expect(confirmDialog(page)).toBeHidden();
    expect(await exists(page, student)).toBe(true);
  });
});
