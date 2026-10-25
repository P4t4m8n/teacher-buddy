import { expect, test, type Locator, type Page } from "@playwright/test";
import { getSampleTeacherAssignments } from "../constants/assignment.constant";
import { countSubmitted } from "../helpers/assignment";
import { formatDate } from "../helpers/date";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import { getStudentList, gotoHydrated, signInAs } from "./helpers";

// The list is hardcoded for now (nothing is saved), so the page is only read and the demo teacher is safe.
const LIST_URL = "/dashboard/assignments";

const sampleFor = async (page: Page, seed: TSeedTeacher): Promise<TTeacherAssignment[]> => {
  await signInAs(page.request, seed);
  return getSampleTeacherAssignments(await getStudentList(page.request));
};

const row = (page: Page, assignment: TTeacherAssignment): Locator =>
  page.locator("tbody tr").filter({ hasText: assignment.title });

test.describe("assignments list", () => {
  let assignments: TTeacherAssignment[];

  test.beforeEach(async ({ page }) => {
    assignments = await sampleFor(page, DEMO_SEED);
    await gotoHydrated(page, LIST_URL);
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

  test("the counts of the first assignment are what the data says", async ({ page }) => {
    const [first] = assignments;

    await expect(row(page, first).locator("td").nth(2)).toHaveText("3");
    await expect(row(page, first).locator("td").nth(3)).toHaveText("2 מתוך 3");
  });

  test("each row has a details link and an edit link, pointing at that assignment", async ({ page }) => {
    for (const assignment of assignments) {
      const details = row(page, assignment).getByRole("link", { name: `פרטים עבור ${assignment.title}` });
      const edit = row(page, assignment).getByRole("link", { name: `עריכה עבור ${assignment.title}` });

      await expect(details).toHaveAttribute("href", `/dashboard/assignments/${assignment.id}`);
      await expect(edit).toHaveAttribute("href", `/dashboard/assignments/${assignment.id}/edit`);
    }
  });

  test("the title is a link to the details page too", async ({ page }) => {
    const [first] = assignments;

    await row(page, first).locator("td").first().getByRole("link", { name: first.title }).click();

    await expect(page).toHaveURL(`/dashboard/assignments/${first.id}`);
    await expect(page.getByRole("heading", { name: first.title, level: 1 })).toBeVisible();
  });

  test("the details button opens that assignment's page", async ({ page }) => {
    const second = assignments[1];

    await row(page, second).getByRole("link", { name: `פרטים עבור ${second.title}` }).click();

    await expect(page).toHaveURL(`/dashboard/assignments/${second.id}`);
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
  test("only has the assignments' students that this teacher has", async ({ page }) => {
    const assignments = await sampleFor(page, OTHER_SEED);
    await gotoHydrated(page, LIST_URL);

    for (const assignment of assignments) {
      await expect(row(page, assignment).locator("td").nth(2)).toHaveText(String(assignment.students.length));
    }
    for (const { students } of DEMO_SEED.classes) {
      for (const { name } of students) await expect(page.getByText(name)).toHaveCount(0);
    }
  });
});

test.describe("assignments list: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("fits the screen, and the due date moves under the title", async ({ page }) => {
    const [first] = await sampleFor(page, DEMO_SEED);
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
