import { expect, test, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, OTHER_SEED } from "../prisma/seed-data";
import { getStudentList, gotoHydrated, signInAs } from "./helpers";

const DASHBOARD_URL = "/dashboard";
const STUDENT_URL = /\/dashboard\/students\/[0-9a-f-]{36}$/;
const FIRST_CLASS = DEMO_SEED.classes[0];
const FIRST_STUDENT = FIRST_CLASS.students[0];
const NOT_FOUND_TEXT = ERROR_MESSAGES.studentNotFound;
const UNKNOWN_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

const idOf = async (page: Page, studentName: string): Promise<string> => {
  const student = (await getStudentList(page.request)).find(({ name }) => name === studentName);
  expect(student).toBeDefined();
  return student!.id;
};

test.describe("student details page", () => {
  test("the details link of a row opens the page with the student's details", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await gotoHydrated(page, DASHBOARD_URL);

    await page.getByRole("link", { name: `פרטים עבור ${FIRST_STUDENT.name}` }).click();

    await expect(page).toHaveURL(STUDENT_URL);
    const details = page.getByRole("region", { name: "פרטי תלמיד" });
    await expect(details.getByRole("heading", { name: FIRST_STUDENT.name })).toBeVisible();
    await expect(details).toContainText(FIRST_CLASS.name);
    await expect(details).toContainText(FIRST_STUDENT.phone);
  });

  test("a direct link works, and survives a refresh", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    const id: string = await idOf(page, FIRST_STUDENT.name);

    await page.goto(`/dashboard/students/${id}`);
    await page.reload();

    await expect(page.getByRole("heading", { name: FIRST_STUDENT.name })).toBeVisible();
  });

  test("shows the page header with the teacher's name", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);

    await page.goto(`/dashboard/students/${await idOf(page, FIRST_STUDENT.name)}`);

    await expect(page.locator("header")).toContainText(DEMO_SEED.name);
  });

  test("the back link returns to the list", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await page.goto(`/dashboard/students/${await idOf(page, FIRST_STUDENT.name)}`);

    await page.getByRole("link", { name: "חזרה לרשימת התלמידים" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
    await expect(page.getByRole("region", { name: "רשימת התלמידים" })).toBeVisible();
  });

  test("the browser Back button returns to the list", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await gotoHydrated(page, DASHBOARD_URL);
    await page.getByRole("link", { name: `פרטים עבור ${FIRST_STUDENT.name}` }).click();
    await expect(page).toHaveURL(STUDENT_URL);

    await page.goBack();

    await expect(page).toHaveURL(DASHBOARD_URL);
  });
});

test.describe("student details page: not found", () => {
  test("a student that does not exist shows the not-found page", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);

    await page.goto(`/dashboard/students/${UNKNOWN_ID}`);

    await expect(page.getByRole("heading", { name: NOT_FOUND_TEXT })).toBeVisible();
  });

  test("an id that is not a uuid shows the same page", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);

    await page.goto("/dashboard/students/not-a-uuid");

    await expect(page.getByRole("heading", { name: NOT_FOUND_TEXT })).toBeVisible();
  });

  test("a student of another teacher shows the same page, and nothing of the student", async ({ page }) => {
    await signInAs(page.request, OTHER_SEED);
    const otherStudent = OTHER_SEED.classes[0].students[0];
    const id: string = await idOf(page, otherStudent.name);
    await signInAs(page.request, DEMO_SEED);

    await page.goto(`/dashboard/students/${id}`);

    await expect(page.getByRole("heading", { name: NOT_FOUND_TEXT })).toBeVisible();
    await expect(page.getByText(otherStudent.name)).toHaveCount(0);
  });

  test("the not-found page links back to the list", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await page.goto(`/dashboard/students/${UNKNOWN_ID}`);

    await page.getByRole("link", { name: "חזרה לרשימת התלמידים" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
  });

  test("without a session it goes to the sign-in page", async ({ page }) => {
    await page.goto(`/dashboard/students/${UNKNOWN_ID}`);

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("student details page: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits the screen", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    await page.goto(`/dashboard/students/${await idOf(page, FIRST_STUDENT.name)}`);

    await expect(page.getByRole("heading", { name: FIRST_STUDENT.name })).toBeVisible();
    const width: number = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
