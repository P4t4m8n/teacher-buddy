import { expect, test, type Locator, type Page } from "@playwright/test";
import { countSubmitted } from "../helpers/assignment";
import { formatDate } from "../helpers/date";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import { findByTitle, getAssignmentsWithStudents, gotoHydrated, signInAs } from "./helpers";

// The list shows what the seed gave to the demo teacher, so the page is only read and the demo teacher is safe.
const LIST_URL = "/dashboard/assignments";

const loadFor = async (page: Page, seed: TSeedTeacher): Promise<TTeacherAssignment[]> => {
  await signInAs(page.request, seed);
  return getAssignmentsWithStudents(page.request);
};

const row = (page: Page, assignment: TTeacherAssignment): Locator =>
  page.locator("tbody tr").filter({ hasText: assignment.title });

test.describe("assignments list", () => {
  let assignments: TTeacherAssignment[];

  test.beforeEach(async ({ page }) => {
    assignments = await loadFor(page, DEMO_SEED);
    await gotoHydrated(page, LIST_URL);
  });

  test("has everything the seed gave the demo teacher", async () => {
    expect(assignments.map(({ title }) => title).sort()).toEqual(
      (DEMO_SEED.assignments ?? []).map(({ title }) => title).sort(),
    );
  });

  test("has a heading with the number of assignments, and an add button next to it", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toContainText(`(${assignments.length})`);
    await expect(page.getByRole("link", { name: "הוספת מטלה" })).toHaveAttribute("href", "/dashboard/assignments/new");
  });

  test("the add button opens the new assignment page", async ({ page }) => {
    await page.getByRole("link", { name: "הוספת מטלה" }).click();

    await expect(page).toHaveURL("/dashboard/assignments/new");
    await expect(page.getByRole("heading", { name: "מטלה חדשה" })).toBeVisible();
  });

  test("shows the column headers on top", async ({ page }) => {
    for (const header of ["שם המטלה", "תאריך הגשה", "תלמידים", "הוגשו", "פעולות"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  test("shows one row per assignment with its due date, its number of students and how many submitted", async ({
    page,
  }) => {
    await expect(page.locator("tbody tr")).toHaveCount(assignments.length);

    for (const assignment of assignments) {
      const cells = row(page, assignment).locator("td");
      await expect(cells.nth(0)).toContainText(assignment.title);
      await expect(cells.nth(1)).toHaveText(formatDate(assignment.dueDate));
      await expect(cells.nth(2)).toHaveText(String(assignment.students.length));
      await expect(cells.nth(3)).toHaveText(`${countSubmitted(assignment)} מתוך ${assignment.students.length}`);
    }
  });

  test("puts the latest due date first", async ({ page }) => {
    const expected: string[] = [...assignments]
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      .map(({ title }) => title);

    const titles: string[] = await page.locator("tbody tr td:first-child a").allInnerTexts();

    expect(titles).toEqual(expected);
  });

  test("the counts are what the seed says: three students and two checked in the first assignment, none submitted in the last", async ({
    page,
  }) => {
    const revolution = findByTitle(assignments, "עבודה על המהפכה התעשייתית");
    const arithmetic = findByTitle(assignments, "תרגילי חשבון - פרק 4");

    await expect(row(page, revolution).locator("td").nth(2)).toHaveText("3");
    await expect(row(page, revolution).locator("td").nth(3)).toHaveText("2 מתוך 3");
    await expect(row(page, arithmetic).locator("td").nth(2)).toHaveText("5");
    await expect(row(page, arithmetic).locator("td").nth(3)).toHaveText("0 מתוך 5");
  });

  test("counts a student who submitted and was not checked yet as submitted", async ({ page }) => {
    const summary = findByTitle(assignments, "סיכום הספר");

    await expect(row(page, summary).locator("td").nth(3)).toHaveText("1 מתוך 2");
  });

  test("each row has a details link and an edit link, pointing at that assignment", async ({ page }) => {
    for (const assignment of assignments) {
      const details = row(page, assignment).getByRole("link", { name: `פרטים עבור ${assignment.title}` });
      const edit = row(page, assignment).getByRole("link", { name: `עריכה עבור ${assignment.title}` });

      await expect(details).toHaveAttribute("href", `/dashboard/assignments/${assignment.id}`);
      await expect(edit).toHaveAttribute("href", `/dashboard/assignments/${assignment.id}/edit`);
    }
  });

  test("the title is a link to the details page too, which opens that assignment", async ({ page }) => {
    const [first] = assignments;

    await row(page, first).locator("td").first().getByRole("link", { name: first.title }).click();

    await expect(page).toHaveURL(`/dashboard/assignments/${first.id}`);
    await expect(page.getByRole("heading", { name: first.title, level: 1 })).toBeVisible();
  });

  test("the details button opens that assignment's page, with its students", async ({ page }) => {
    const second = assignments[1];

    await row(page, second).getByRole("link", { name: `פרטים עבור ${second.title}` }).click();

    await expect(page).toHaveURL(`/dashboard/assignments/${second.id}`);
    // The list that was left stays in the page, hidden, so only the visible rows are the students.
    await expect(page.locator("tbody tr:visible")).toHaveCount(second.students.length);
  });

  test("the edit button opens that assignment's edit page, filled in", async ({ page }) => {
    const third = assignments[2];

    await row(page, third).getByRole("link", { name: `עריכה עבור ${third.title}` }).click();

    await expect(page).toHaveURL(`/dashboard/assignments/${third.id}/edit`);
    await expect(page.getByLabel("שם המטלה")).toHaveValue(third.title);
  });

  test("the list is a region the keyboard can scroll", async ({ page }) => {
    const region = page.getByRole("region", { name: "רשימת המטלות" });

    await region.focus();

    await expect(region).toBeFocused();
  });
});

test.describe("assignments list: another teacher", () => {
  test("only has that teacher's own assignments", async ({ page }) => {
    const assignments = await loadFor(page, OTHER_SEED);
    await gotoHydrated(page, LIST_URL);

    expect(assignments.map(({ title }) => title)).toEqual((OTHER_SEED.assignments ?? []).map(({ title }) => title));
    await expect(page.locator("tbody tr")).toHaveCount(assignments.length);
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toContainText(`(${assignments.length})`);
    for (const { title } of DEMO_SEED.assignments ?? []) await expect(page.getByText(title)).toHaveCount(0);
    for (const assignment of assignments) {
      await expect(row(page, assignment).locator("td").nth(2)).toHaveText(String(assignment.students.length));
    }
  });
});

test.describe("assignments list: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("fits the screen, and the due date moves under the title", async ({ page }) => {
    const [first] = await loadFor(page, DEMO_SEED);
    await gotoHydrated(page, LIST_URL);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole("columnheader", { name: "תאריך הגשה" })).toBeHidden();
    await expect(page.getByRole("columnheader", { name: "תלמידים" })).toBeHidden();
    await expect(row(page, first).getByText(`להגשה עד ${formatDate(first.dueDate)}`)).toBeVisible();
    await expect(row(page, first).getByRole("link", { name: `פרטים עבור ${first.title}` })).toBeVisible();
  });
});

test.describe("assignments list: access", () => {
  test("needs a sign-in", async ({ page }) => {
    await page.goto(LIST_URL);

    await expect(page).toHaveURL(/\/auth$/);
  });
});
