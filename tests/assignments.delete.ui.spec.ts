import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { DEMO_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import {
  getAssignmentById,
  getSeededStudentList,
  gotoHydrated,
  randomLetters,
  removeViaApi,
  signInAs,
  submitPart,
  withTestDb,
} from "./helpers";

// These tests delete assignments, so they only use a write teacher and only delete assignments they created
// themselves (see helpers). The one test with the demo teacher only opens the dialog and cancels.
const LIST_URL = "/dashboard/assignments";
const CONFIRM_TITLE = "מחיקת מטלה";
const NOT_FOUND_MESSAGE = ERROR_MESSAGES.assignmentNotFound;

// The list updates through router.refresh(), a request to the dev server. When many tests run at once
// it can take longer than the default 5 seconds, so the checks that wait for it are given more time.
const REFRESH = { timeout: 20_000 };

type TFixture = { students: TStudent[]; assignment: TTeacherAssignment };

// An assignment the test owns, given to both seeded students of the write teacher (both TODO).
const createAssignment = async (page: Page): Promise<TFixture> => {
  const students: TStudent[] = await getSeededStudentList(page.request, WRITE_SEED);
  const response = await page.request.post("/api/assignments", {
    data: {
      title: `מטלה ${randomLetters(10)}`,
      description: "<p>הנחיות</p>",
      dueDate: "2030-06-15",
      studentIds: students.map(({ id }) => id),
    },
  });
  expect(response.status()).toBe(201);
  return { students, assignment: (await response.json()).assignment };
};

const exists = async (page: Page, assignment: TTeacherAssignment): Promise<boolean> =>
  (await getAssignmentById(page.request, assignment.id)) !== undefined;

const assignmentRow = (page: Page, title: string): Locator => page.locator("tbody tr:visible").filter({ hasText: title });
const deleteButton = (page: Page, title: string): Locator => page.getByRole("button", { name: `מחיקה עבור ${title}` });
const confirmDialog = (page: Page): Locator => page.getByRole("dialog", { name: CONFIRM_TITLE });
const confirmButton = (page: Page): Locator => confirmDialog(page).getByRole("button", { name: "מחיקה", exact: true });
const warning = (page: Page): Locator => confirmDialog(page).getByRole("note");

const deleteUrl = (assignment: TTeacherAssignment): string => `**/api/assignments/${assignment.id}`;

// Answers only the DELETE request, so the page can still load the assignment normally.
const interceptDelete = (page: Page, assignment: TTeacherAssignment, handler: (route: Route) => Promise<void> | void) =>
  page.route(deleteUrl(assignment), (route: Route) =>
    route.request().method() === "DELETE" ? handler(route) : route.fallback(),
  );

const openList = async (page: Page): Promise<TFixture> => {
  await signInAs(page.request, WRITE_SEED);
  const fixture: TFixture = await createAssignment(page);
  await gotoHydrated(page, LIST_URL);
  await expect(assignmentRow(page, fixture.assignment.title)).toBeVisible();
  return fixture;
};

// Gives a student a file (and a grade) straight in the database, before the list is opened.
const submit = (fixture: TFixture, index: number, grade: number | null): Promise<void> =>
  submitPart(fixture.assignment.id, fixture.students[index].id, {
    submittedAt: "2030-06-01T10:00:00Z",
    grade,
    mimeType: "application/pdf",
  });

const openListWithSubmitted = async (page: Page, grades: (number | null)[]): Promise<TFixture> => {
  await signInAs(page.request, WRITE_SEED);
  const fixture: TFixture = await createAssignment(page);
  for (const [index, grade] of grades.entries()) await submit(fixture, index, grade);
  await gotoHydrated(page, LIST_URL);
  await expect(assignmentRow(page, fixture.assignment.title)).toBeVisible();
  return fixture;
};

const countFiles = (assignmentId: string): Promise<number> =>
  withTestDb(async (client) => {
    const result = await client.query(
      `select count(*)::int as count from "SubmissionFile" f
       join "AssignmentStudent" s on s.id = f."assignmentStudentId" where s."assignmentId" = $1::uuid`,
      [assignmentId],
    );
    return result.rows[0].count;
  });

test.describe("delete assignment: the confirmation", () => {
  test("the delete button asks for confirmation first, naming the assignment, and deletes nothing yet", async ({ page }) => {
    const { assignment } = await openList(page);

    await deleteButton(page, assignment.title).click();

    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(assignment.title);
    await expect(dialog).toContainText("ולא ניתן לשחזר");
    await expect(dialog.getByRole("button", { name: "מחיקה", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ביטול" })).toBeVisible();
    expect(await exists(page, assignment)).toBe(true);
  });

  test("cancel closes it and keeps the assignment", async ({ page }) => {
    const { assignment } = await openList(page);
    await deleteButton(page, assignment.title).click();

    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await expect(confirmDialog(page)).toBeHidden();
    await expect(assignmentRow(page, assignment.title)).toBeVisible();
    expect(await exists(page, assignment)).toBe(true);
  });

  test("Escape closes it and keeps the assignment", async ({ page }) => {
    const { assignment } = await openList(page);
    await deleteButton(page, assignment.title).click();
    await expect(confirmDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(confirmDialog(page)).toBeHidden();
    expect(await exists(page, assignment)).toBe(true);
  });

  test("each row has its own button, and it opens the dialog of that row", async ({ page }) => {
    const first = await openList(page);
    const second = await createAssignment(page);
    await page.reload();
    await gotoHydrated(page, LIST_URL);

    await deleteButton(page, second.assignment.title).click();

    await expect(confirmDialog(page)).toContainText(second.assignment.title);
    await expect(confirmDialog(page)).not.toContainText(first.assignment.title);
  });

  test("the row has the delete button next to the details and edit links", async ({ page }) => {
    const { assignment } = await openList(page);
    const row = assignmentRow(page, assignment.title);

    await expect(row.getByRole("link", { name: `פרטים עבור ${assignment.title}` })).toBeVisible();
    await expect(row.getByRole("link", { name: `עריכה עבור ${assignment.title}` })).toBeVisible();
    await expect(row.getByRole("button", { name: `מחיקה עבור ${assignment.title}` })).toBeVisible();
  });
});

test.describe("delete assignment: the extra warning when students already submitted", () => {
  test("nobody submitted: no extra warning", async ({ page }) => {
    const { assignment } = await openList(page);

    await deleteButton(page, assignment.title).click();

    await expect(confirmDialog(page)).toBeVisible();
    await expect(warning(page)).toHaveCount(0);
  });

  test("one student submitted: the warning says so, and that the file and the grade are deleted too", async ({ page }) => {
    const { assignment } = await openListWithSubmitted(page, [null]);

    await deleteButton(page, assignment.title).click();

    await expect(warning(page)).toBeVisible();
    await expect(warning(page)).toContainText("תלמיד אחד כבר הגיש");
    await expect(warning(page)).toContainText("הקבצים שהועלו והציונים שניתנו יימחקו");
  });

  test("two students submitted, one of them checked: the warning counts both", async ({ page }) => {
    const { assignment } = await openListWithSubmitted(page, [null, 85]);

    await deleteButton(page, assignment.title).click();

    await expect(warning(page)).toContainText("2 תלמידים כבר הגישו");
  });

  test("the warning is only in the dialog of the assignment that has submissions", async ({ page }) => {
    const withFiles = await openListWithSubmitted(page, [70]);
    const without = await createAssignment(page);
    await page.reload();
    await gotoHydrated(page, LIST_URL);

    await deleteButton(page, without.assignment.title).click();
    await expect(confirmDialog(page)).toBeVisible();
    await expect(warning(page)).toHaveCount(0);
    await page.keyboard.press("Escape");

    await deleteButton(page, withFiles.assignment.title).click();
    await expect(warning(page)).toContainText("תלמיד אחד כבר הגיש");
  });

  test("the warning follows the count in the list row", async ({ page }) => {
    const { assignment } = await openListWithSubmitted(page, [null, 60]);

    await expect(assignmentRow(page, assignment.title).locator("td").nth(3)).toHaveText("2 מתוך 2");
    await deleteButton(page, assignment.title).click();

    await expect(warning(page)).toContainText("2 תלמידים כבר הגישו");
  });

  test("the demo teacher's seeded assignment shows its warning, and cancel keeps everything", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);
    const title = "עבודה על המהפכה התעשייתית";
    await gotoHydrated(page, LIST_URL);

    await deleteButton(page, title).click();

    await expect(warning(page)).toContainText("2 תלמידים כבר הגישו");
    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();
    await expect(assignmentRow(page, title)).toBeVisible();
  });
});

test.describe("delete assignment: deleting", () => {
  test("confirming deletes the assignment, closes the dialog and removes the row", async ({ page }) => {
    const { assignment } = await openList(page);
    await deleteButton(page, assignment.title).click();

    await confirmButton(page).click();

    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);
    await expect(page.getByRole("dialog")).toHaveCount(0, REFRESH);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    expect(await exists(page, assignment)).toBe(false);
  });

  test("deletes only that assignment", async ({ page }) => {
    const first = await openList(page);
    const second = await createAssignment(page);
    await page.reload();
    await gotoHydrated(page, LIST_URL);
    await deleteButton(page, first.assignment.title).click();

    await confirmButton(page).click();

    await expect(assignmentRow(page, first.assignment.title)).toHaveCount(0, REFRESH);
    await expect(assignmentRow(page, second.assignment.title)).toBeVisible();
    expect(await exists(page, first.assignment)).toBe(false);
    expect(await exists(page, second.assignment)).toBe(true);
  });

  test("deletes the files and the grades of its students too, and keeps the students", async ({ page }) => {
    const fixture = await openListWithSubmitted(page, [null, 90]);
    expect(await countFiles(fixture.assignment.id)).toBe(2);
    await deleteButton(page, fixture.assignment.title).click();

    await confirmButton(page).click();

    await expect(assignmentRow(page, fixture.assignment.title)).toHaveCount(0, REFRESH);
    expect(await countFiles(fixture.assignment.id)).toBe(0);
    const students = await getSeededStudentList(page.request, WRITE_SEED);
    expect(students.map(({ id }) => id).sort()).toEqual(fixture.students.map(({ id }) => id).sort());
  });

  test("the students' own pages no longer list it", async ({ page }) => {
    const fixture = await openList(page);
    await deleteButton(page, fixture.assignment.title).click();
    await confirmButton(page).click();
    await expect(assignmentRow(page, fixture.assignment.title)).toHaveCount(0, REFRESH);

    await gotoHydrated(page, `/dashboard/students/${fixture.students[0].id}`);

    await expect(page.getByText(fixture.assignment.title)).toHaveCount(0);
  });

  test("its page shows the not-found page after it was deleted", async ({ page }) => {
    const { assignment } = await openList(page);
    await deleteButton(page, assignment.title).click();
    await confirmButton(page).click();
    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);

    await page.goto(`/dashboard/assignments/${assignment.id}`);

    await expect(page.getByRole("heading", { name: NOT_FOUND_MESSAGE })).toBeVisible();
  });

  test("while deleting, the buttons are disabled and it says so", async ({ page }) => {
    const { assignment } = await openList(page);
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await interceptDelete(page, assignment, async (route) => {
      await released;
      await route.continue();
    });
    await deleteButton(page, assignment.title).click();

    await confirmButton(page).click();

    await expect(confirmDialog(page).getByRole("button", { name: "מוחק..." })).toBeDisabled();
    await expect(confirmDialog(page).getByRole("button", { name: "ביטול" })).toBeDisabled();

    release();
    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);
  });

  test("a second click while deleting sends one request only", async ({ page }) => {
    const { assignment } = await openList(page);
    let deletes = 0;
    await interceptDelete(page, assignment, async (route) => {
      deletes += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await deleteButton(page, assignment.title).click();

    await confirmButton(page).click();
    await confirmDialog(page).getByRole("button", { name: "מוחק..." }).click({ force: true, timeout: 1000 }).catch(() => {});

    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);
    expect(deletes).toBe(1);
  });
});

test.describe("delete assignment: errors", () => {
  test("shows the server's message, keeps the dialog and the assignment, and can be retried", async ({ page }) => {
    const { assignment } = await openList(page);
    await interceptDelete(page, assignment, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: ERROR_MESSAGES.internal }) }),
    );
    await deleteButton(page, assignment.title).click();

    await confirmButton(page).click();

    await expect(confirmDialog(page).getByRole("alert")).toHaveText(ERROR_MESSAGES.internal);
    await expect(confirmButton(page)).toBeEnabled();
    expect(await exists(page, assignment)).toBe(true);

    await page.unroute(deleteUrl(assignment));
    await confirmButton(page).click();

    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);
    expect(await exists(page, assignment)).toBe(false);
  });

  test("shows the network message when the server cannot be reached", async ({ page }) => {
    const { assignment } = await openList(page);
    await interceptDelete(page, assignment, (route) => route.abort());
    await deleteButton(page, assignment.title).click();

    await confirmButton(page).click();

    await expect(confirmDialog(page).getByRole("alert")).toHaveText(ERROR_MESSAGES.network);
    expect(await exists(page, assignment)).toBe(true);
  });

  test("an error is gone the next time the dialog opens", async ({ page }) => {
    const { assignment } = await openList(page);
    await interceptDelete(page, assignment, (route) => route.abort());
    await deleteButton(page, assignment.title).click();
    await confirmButton(page).click();
    await expect(confirmDialog(page).getByRole("alert")).toBeVisible();
    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await deleteButton(page, assignment.title).click();

    await expect(confirmDialog(page)).toBeVisible();
    await expect(confirmDialog(page).getByRole("alert")).toHaveCount(0);
  });

  test("when the assignment was already deleted elsewhere, it shows the server's message", async ({ page }) => {
    const { assignment } = await openList(page);
    await deleteButton(page, assignment.title).click();
    await removeViaApi(page.request, `/api/assignments/${assignment.id}`);

    await confirmButton(page).click();

    await expect(confirmDialog(page).getByRole("alert")).toHaveText(NOT_FOUND_MESSAGE);
  });
});

test.describe("delete assignment: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("deleting confirms, deletes and removes the row", async ({ page }) => {
    const { assignment } = await openList(page);

    await deleteButton(page, assignment.title).click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmButton(page).click();

    await expect(assignmentRow(page, assignment.title)).toHaveCount(0, REFRESH);
    expect(await exists(page, assignment)).toBe(false);
  });

  test("the dialog with the extra warning fits the screen, and cancelling keeps the assignment", async ({ page }) => {
    const { assignment } = await openListWithSubmitted(page, [null, 80]);
    await deleteButton(page, assignment.title).click();

    await expect(warning(page)).toBeVisible();
    const box = await confirmDialog(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await confirmDialog(page).getByRole("button", { name: "ביטול" }).click();

    await expect(confirmDialog(page)).toBeHidden();
    expect(await exists(page, assignment)).toBe(true);
  });

  test("the row's three buttons fit the screen", async ({ page }) => {
    const { assignment } = await openList(page);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(assignmentRow(page, assignment.title).getByRole("button", { name: `מחיקה עבור ${assignment.title}` })).toBeVisible();
  });
});

test.describe("delete assignment: access", () => {
  test("the endpoint refuses a delete without a session", async ({ page }) => {
    const response = await page.request.delete("/api/assignments/0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60");

    expect(response.status()).toBe(401);
  });
});
