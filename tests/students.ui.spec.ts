import { expect, test, type Page } from "@playwright/test";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import { gotoHydrated } from "./helpers";

const DASHBOARD_URL = "/dashboard";
const FIRST_STUDENT = DEMO_SEED.classes[0].students[0];
const ACTION_LABELS = ["פרטים", "עריכה"];
const ACTION_PATHS = [
  /\/dashboard\/students\/[0-9a-f-]{36}$/,
  /\/dashboard\/students\/[0-9a-f-]{36}\/edit$/,
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

  test("each row has the details and edit links, pointing at that student's pages, and a delete button", async ({ page }) => {
    const row = studentRow(page, FIRST_STUDENT.name);

    for (const [index, label] of ACTION_LABELS.entries()) {
      const link = row.getByRole("link", { name: `${label} עבור ${FIRST_STUDENT.name}` });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", ACTION_PATHS[index]);
    }
    await expect(row.getByRole("button", { name: `מחיקה עבור ${FIRST_STUDENT.name}` })).toBeVisible();
  });

  test("the details link opens the student's page", async ({ page }) => {
    await studentRow(page, FIRST_STUDENT.name)
      .getByRole("link", { name: `פרטים עבור ${FIRST_STUDENT.name}` })
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

  test("keeps the three actions on a narrow screen, inside the screen", async ({ page }) => {
    const row = studentRow(page, FIRST_STUDENT.name);

    for (const label of ACTION_LABELS) {
      await expect(row.getByRole("link", { name: `${label} עבור ${FIRST_STUDENT.name}` })).toBeVisible();
    }
    await expect(row.getByRole("button", { name: `מחיקה עבור ${FIRST_STUDENT.name}` })).toBeVisible();

    const width: number = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("the details link opens the student's page", async ({ page }) => {
    await studentRow(page, FIRST_STUDENT.name)
      .getByRole("link", { name: `פרטים עבור ${FIRST_STUDENT.name}` })
      .click();

    await expect(page).toHaveURL(ACTION_PATHS[0]);
  });
});

test.describe("students table: scrolling", () => {
  const studentsRegion = (page: Page) => page.getByRole("region", { name: "רשימת התלמידים" });

  const pageMetrics = (page: Page) =>
    page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
    }));

  test.beforeEach(async ({ page }) => {
    await signInAs(page, DEMO_SEED);
  });

  const SHORT_SCREENS = [
    { label: "wide", viewport: { width: 1280, height: 500 } },
    { label: "narrow", viewport: { width: 390, height: 700 } },
  ];

  for (const { label, viewport } of SHORT_SCREENS) {
    test(`${label} short screen: only the student rows scroll, not the page`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoHydrated(page, DASHBOARD_URL);
      const region = studentsRegion(page);

      // The page itself fits the screen.
      const before = await pageMetrics(page);
      expect(before.scrollHeight).toBeLessThanOrEqual(before.innerHeight);

      // The list is taller than its box, so it scrolls inside.
      const sizes = await region.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);

      // Scrolling over the list moves the rows and leaves the page where it is.
      await expect(page.locator("tbody tr").first()).toBeInViewport();
      await region.hover();
      await page.mouse.wheel(0, 3000);
      await expect(page.locator("tbody tr").last()).toBeInViewport();
      await expect(page.locator("tbody tr").first()).not.toBeInViewport();
      expect((await pageMetrics(page)).scrollY).toBe(0);

      // The page header and the table header stay put while the rows scroll.
      await expect(page.getByRole("button", { name: "התנתקות" })).toBeInViewport();
      const regionBox = await region.boundingBox();
      const headerBox = await page.getByRole("columnheader", { name: "שם" }).boundingBox();
      expect(Math.abs(headerBox!.y - regionBox!.y)).toBeLessThanOrEqual(2);
    });
  }

  test("tall screen: the list is only as tall as its rows and does not scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await gotoHydrated(page, DASHBOARD_URL);
    const region = studentsRegion(page);

    const sizes = await region.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.clientHeight);

    const box = await region.boundingBox();
    expect(box!.y + box!.height).toBeLessThan(1600 - 100);
  });

  test("the scrollable list can be focused, so the keyboard can scroll it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await gotoHydrated(page, DASHBOARD_URL);
    const region = studentsRegion(page);

    await region.focus();
    await page.keyboard.press("End");

    await expect(page.locator("tbody tr").last()).toBeInViewport();
    expect((await pageMetrics(page)).scrollY).toBe(0);
  });
});
