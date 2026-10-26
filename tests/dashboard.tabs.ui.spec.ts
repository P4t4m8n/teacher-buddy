import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_SEED } from "../prisma/seed-data";
import { getAssignmentList, getStudentList, gotoHydrated, signInAs } from "./helpers";

// Tabs only navigate, so the demo teacher is safe to use.
const STUDENTS_URL = "/dashboard";
const ASSIGNMENTS_URL = "/dashboard/assignments";

const tabs = (page: Page): Locator => page.getByRole("navigation", { name: "אזורי הלוח" });
const studentsTab = (page: Page): Locator => tabs(page).getByRole("link", { name: "תלמידים" });
const assignmentsTab = (page: Page): Locator => tabs(page).getByRole("link", { name: "מטלות" });

const expectActive = async (page: Page, active: "students" | "assignments"): Promise<void> => {
  const [on, off] = active === "students" ? [studentsTab(page), assignmentsTab(page)] : [assignmentsTab(page), studentsTab(page)];
  await expect(on).toHaveAttribute("aria-current", "page");
  await expect(off).not.toHaveAttribute("aria-current", "page");
};

const firstStudentId = async (page: Page): Promise<string> => (await getStudentList(page.request))[0].id;
const firstAssignmentId = async (page: Page): Promise<string> => (await getAssignmentList(page.request))[0].id;

test.beforeEach(async ({ page }) => {
  await signInAs(page.request, DEMO_SEED);
});

test.describe("dashboard tabs: the bar", () => {
  test("has the students and assignments tabs, in that order, linking to their pages", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    await expect(tabs(page).getByRole("link")).toHaveText(["תלמידים", "מטלות"]);
    await expect(studentsTab(page)).toHaveAttribute("href", STUDENTS_URL);
    await expect(assignmentsTab(page)).toHaveAttribute("href", ASSIGNMENTS_URL);
  });

  test("sits between the header and the page", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    const header = await page.locator("header").boundingBox();
    const bar = await tabs(page).boundingBox();
    const main = await page.locator("main").first().boundingBox();
    expect(bar!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(main!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);
  });

  test("shows the active tab differently, not only by colour", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    const active = await studentsTab(page).evaluate((element) => getComputedStyle(element).borderBottomWidth);
    const idle = await assignmentsTab(page).evaluate((element) => getComputedStyle(element).borderBottomColor);
    expect(active).toBe("2px");
    expect(idle).toBe("rgba(0, 0, 0, 0)");
    await expectActive(page, "students");
  });

  test("is not on the sign-in page", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto("/auth");

    await expect(page.getByRole("navigation", { name: "אזורי הלוח" })).toHaveCount(0);
  });
});

test.describe("dashboard tabs: switching", () => {
  test("clicking a tab opens its page and moves the active mark, and back", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);
    await expectActive(page, "students");

    await assignmentsTab(page).click();
    await expect(page).toHaveURL(ASSIGNMENTS_URL);
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toBeVisible();
    await expectActive(page, "assignments");

    await studentsTab(page).click();
    await expect(page).toHaveURL(STUDENTS_URL);
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toBeVisible();
    await expectActive(page, "students");
  });

  test("the browser Back and Forward buttons follow the tabs", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);
    await assignmentsTab(page).click();
    await expect(page).toHaveURL(ASSIGNMENTS_URL);

    await page.goBack();
    await expect(page).toHaveURL(STUDENTS_URL);
    await expectActive(page, "students");

    await page.goForward();
    await expect(page).toHaveURL(ASSIGNMENTS_URL);
    await expectActive(page, "assignments");
  });

  test("a direct link and a refresh keep the tab", async ({ page }) => {
    await gotoHydrated(page, ASSIGNMENTS_URL);
    await expectActive(page, "assignments");

    await page.reload();

    await expect(page).toHaveURL(ASSIGNMENTS_URL);
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toBeVisible();
    await expectActive(page, "assignments");
  });

  test("the header stays while the tabs change", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    await assignmentsTab(page).click();

    await expect(page.locator("header")).toContainText(DEMO_SEED.name);
    await expect(page.getByRole("button", { name: "התנתקות" })).toBeVisible();
  });

  test("the keyboard can reach a tab and open it", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    await assignmentsTab(page).focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(ASSIGNMENTS_URL);
  });

  test("switching tabs raises no errors or warnings in the browser", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

    await gotoHydrated(page, STUDENTS_URL);
    await assignmentsTab(page).click();
    await expect(page).toHaveURL(ASSIGNMENTS_URL);
    await studentsTab(page).click();
    await expect(page).toHaveURL(STUDENTS_URL);

    expect(problems).toEqual([]);
  });
});

test.describe("dashboard tabs: on the other dashboard pages", () => {
  test("no dashboard page raises an error or a warning in the browser", async ({ page }) => {
    // Next.js reports reading the address outside Suspense as a console error on pages with a dynamic id.
    const problems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) problems.push(`${message.type()}: ${message.text().slice(0, 200)}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`));
    const id: string = await firstStudentId(page);
    const assignmentId: string = await firstAssignmentId(page);

    for (const url of [
      STUDENTS_URL,
      `/dashboard/students/${id}`,
      `/dashboard/students/${id}/edit`,
      "/dashboard/students/new",
      ASSIGNMENTS_URL,
      `${ASSIGNMENTS_URL}/${assignmentId}`,
      `${ASSIGNMENTS_URL}/${assignmentId}/edit`,
      `${ASSIGNMENTS_URL}/new`,
    ]) {
      await gotoHydrated(page, url);
      await expect(tabs(page)).toBeVisible();
    }

    expect(problems).toEqual([]);
  });

  test("the students tab is active on the student pages", async ({ page }) => {
    const id: string = await firstStudentId(page);

    for (const url of [`/dashboard/students/${id}`, `/dashboard/students/${id}/edit`, "/dashboard/students/new"]) {
      await page.goto(url);
      await expect(tabs(page)).toBeVisible();
      await expectActive(page, "students");
    }
  });

  test("the assignments tab is active on the assignment pages", async ({ page }) => {
    const assignmentId: string = await firstAssignmentId(page);

    for (const url of [
      `${ASSIGNMENTS_URL}/${assignmentId}`,
      `${ASSIGNMENTS_URL}/${assignmentId}/edit`,
      `${ASSIGNMENTS_URL}/new`,
    ]) {
      await page.goto(url);
      await expect(tabs(page)).toBeVisible();
      await expectActive(page, "assignments");
    }
  });

  test("the tabs stay on a page that is not found", async ({ page }) => {
    await page.goto(`${ASSIGNMENTS_URL}/0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60`);

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
    await expect(tabs(page)).toBeVisible();
    await expectActive(page, "assignments");
  });

  test("a tab leads out of a form page", async ({ page }) => {
    await page.goto(`${ASSIGNMENTS_URL}/new`);

    await studentsTab(page).click();

    await expect(page).toHaveURL(STUDENTS_URL);
  });
});

test.describe("dashboard tabs: access", () => {
  test("the assignments page needs a sign-in", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(ASSIGNMENTS_URL);

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("dashboard tabs: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("both tabs fit, and the page does not scroll sideways", async ({ page }) => {
    await gotoHydrated(page, STUDENTS_URL);

    await expect(studentsTab(page)).toBeVisible();
    await expect(assignmentsTab(page)).toBeVisible();
    const bar = await tabs(page).boundingBox();
    expect(bar!.x).toBeGreaterThanOrEqual(0);
    expect(bar!.x + bar!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await assignmentsTab(page).click();
    await expect(page).toHaveURL(ASSIGNMENTS_URL);
    await expectActive(page, "assignments");
  });
});
