import { expect, test, type Page } from "@playwright/test";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import { gotoHydrated } from "./helpers";

const DASHBOARD_URL = "/dashboard";
const FIRST_STUDENT = DEMO_SEED.classes[0].students[0];
const ACTION_LABELS = ["מטלה חדשה", "עריכת מטלה", "הזנת ציון"];
const ACTION_PATHS = [
  /\/students\/[0-9a-f-]{36}\/assignments\/new$/,
  /\/students\/[0-9a-f-]{36}\/assignments$/,
  /\/students\/[0-9a-f-]{36}\/grade$/,
];

// page.request shares its cookies with the page, so this signs the browser in without the UI.
const signInAs = async (page: Page, seed: TSeedTeacher): Promise<void> => {
  const login = await page.request.post("/api/auth/login", {
    data: { name: seed.name, idNumber: seed.idNumber },
  });
  expect(login.status()).toBe(200);
};

const studentRow = (page: Page, studentName: string) =>
  page.locator("tbody tr").filter({ hasText: studentName });

const countStudents = (seed: TSeedTeacher): number =>
  seed.classes.reduce((sum, { students }) => sum + students.length, 0);

test.describe("students table: wide screen", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, DEMO_SEED);
    await gotoHydrated(page, DASHBOARD_URL);
  });

  test("shows the column headers on top", async ({ page }) => {
    for (const header of ["שם", "כיתה", "טלפון", "פעולות"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  test("shows one row per student with the class and the phone", async ({ page }) => {
    await expect(page.locator("tbody tr")).toHaveCount(countStudents(DEMO_SEED));
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toContainText(
      `(${countStudents(DEMO_SEED)})`,
    );

    for (const { name: className, students } of DEMO_SEED.classes) {
      for (const { name, phone } of students) {
        const cells = studentRow(page, name).locator("td");
        await expect(cells.nth(0)).toContainText(name);
        await expect(cells.nth(1)).toHaveText(className);
        await expect(cells.nth(2)).toHaveText(phone);
      }
    }
  });

  test("shows only the signed-in teacher's students", async ({ page }) => {
    for (const { students } of OTHER_SEED.classes) {
      for (const { name } of students) {
        await expect(page.getByText(name)).toHaveCount(0);
      }
    }
  });

  test("each row has the three action links, pointing at that student's pages", async ({ page }) => {
    const row = studentRow(page, FIRST_STUDENT.name);

    for (const [index, label] of ACTION_LABELS.entries()) {
      const link = row.getByRole("link", { name: `${label} עבור ${FIRST_STUDENT.name}` });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", ACTION_PATHS[index]);
    }
  });

  test("hides the mobile actions button", async ({ page }) => {
    const row = studentRow(page, FIRST_STUDENT.name);

    await expect(row.getByRole("button", { name: `פעולות עבור ${FIRST_STUDENT.name}` })).toBeHidden();
  });

  test("an action link opens that page", async ({ page }) => {
    await studentRow(page, FIRST_STUDENT.name)
      .getByRole("link", { name: `מטלה חדשה עבור ${FIRST_STUDENT.name}` })
      .click();

    await expect(page).toHaveURL(ACTION_PATHS[0]);
  });
});

test.describe("students table: another teacher", () => {
  test("shows only that teacher's students", async ({ page }) => {
    await signInAs(page, OTHER_SEED);
    await gotoHydrated(page, DASHBOARD_URL);

    await expect(page.locator("tbody tr")).toHaveCount(countStudents(OTHER_SEED));
    for (const { students } of DEMO_SEED.classes) {
      for (const { name } of students) {
        await expect(page.getByText(name)).toHaveCount(0);
      }
    }
  });
});

test.describe("students table: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const sheetTriggerName = `פעולות עבור ${FIRST_STUDENT.name}`;

  test.beforeEach(async ({ page }) => {
    await signInAs(page, DEMO_SEED);
    await gotoHydrated(page, DASHBOARD_URL);
  });

  test("moves the phone under the name and hides the phone column", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "טלפון" })).toBeHidden();
    await expect(
      studentRow(page, FIRST_STUDENT.name).locator("td").first().getByText(FIRST_STUDENT.phone),
    ).toBeVisible();
  });

  test("replaces the action links with one button", async ({ page }) => {
    const row = studentRow(page, FIRST_STUDENT.name);

    await expect(row.getByRole("button", { name: sheetTriggerName })).toBeVisible();
    await expect(row.getByRole("link", { name: /מטלה חדשה עבור/ })).toBeHidden();
  });

  test("the button opens a bottom sheet with the three links", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();

    const sheet = page.getByRole("dialog", { name: sheetTriggerName });
    await expect(sheet).toBeVisible();
    for (const [index, label] of ACTION_LABELS.entries()) {
      const link = sheet.getByRole("link", { name: label });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", ACTION_PATHS[index]);
    }

    // The sheet sits at the bottom of the screen.
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeGreaterThan(844 - 2);
  });

  test("Escape closes the sheet", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the close button closes the sheet", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();

    await page.getByRole("dialog").getByRole("button", { name: "סגירה" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("tapping the backdrop closes the sheet", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.mouse.click(195, 30);

    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the page behind the open sheet cannot scroll", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();

    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("a link in the sheet opens that page", async ({ page }) => {
    await page.getByRole("button", { name: sheetTriggerName }).click();

    await page.getByRole("dialog").getByRole("link", { name: "הזנת ציון" }).click();

    await expect(page).toHaveURL(ACTION_PATHS[2]);
  });

  test("each student has their own sheet", async ({ page }) => {
    const second = DEMO_SEED.classes[0].students[1];

    await page.getByRole("button", { name: `פעולות עבור ${second.name}` }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toHaveAccessibleName(`פעולות עבור ${second.name}`);
    await expect(sheet.getByRole("link", { name: "מטלה חדשה" })).toBeVisible();
  });
});
