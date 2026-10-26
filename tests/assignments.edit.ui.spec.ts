import { expect, test, type Locator, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { formatDate } from "../helpers/date";
import { WRITE_SEED } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import {
  createStudent,
  getAssignmentById,
  getAssignmentList,
  getSeededStudentList,
  gotoHydrated,
  randomLetters,
  removeViaApi,
  signInAs,
  submitPart,
} from "./helpers";

// These tests change assignments, so they only use a write teacher and only change assignments they created
// themselves (see helpers). The global setup removes what they create before a run.
const LIST_URL = "/dashboard/assignments";
const DESCRIPTION = "<h2>הנחיות</h2><p>טקסט <strong>מקורי</strong></p>";

const TITLE_TOO_SHORT = "שם המטלה חייב להכיל לפחות 2 תווים";
const DATE_INVALID = "תאריך ההגשה אינו תקין";
const STUDENTS_REQUIRED = "יש לבחור לפחות תלמיד אחד";

// Saving goes through the API and then to the list, which can take longer than 5 seconds when many tests
// run at once.
const SAVED = { timeout: 20_000 };

const uniqueTitle = (): string => `מטלה ${randomLetters(10)}`;
const editUrl = (assignment: TTeacherAssignment): string => `/dashboard/assignments/${assignment.id}/edit`;
const apiUrl = (assignment: TTeacherAssignment): string => `**/api/assignments/${assignment.id}`;

const titleField = (page: Page): Locator => page.getByLabel("שם המטלה");
const dueDateField = (page: Page): Locator => page.getByLabel("תאריך הגשה");
const studentBox = (page: Page, name: string): Locator => page.getByRole("checkbox", { name, exact: true });
const editor = (page: Page): Locator => page.getByRole("textbox", { name: "תיאור המטלה" });
const saveButton = (page: Page): Locator => page.getByRole("button", { name: "שמירה", exact: true });
const save = (page: Page): Promise<void> => saveButton(page).click();
const assignmentRow = (page: Page, title: string): Locator => page.locator("tbody tr:visible").filter({ hasText: title });

type TFixture = { students: TStudent[]; assignment: TTeacherAssignment };

// An assignment the test owns, given to the first seeded student, and its edit page opened.
const openEditPage = async (page: Page): Promise<TFixture> => {
  await signInAs(page.request, WRITE_SEED);
  const students: TStudent[] = await getSeededStudentList(page.request, WRITE_SEED);
  const response = await page.request.post("/api/assignments", {
    data: { title: uniqueTitle(), description: DESCRIPTION, dueDate: "2030-06-15", studentIds: [students[0].id] },
  });
  expect(response.status()).toBe(201);
  const assignment: TTeacherAssignment = (await response.json()).assignment;
  await gotoHydrated(page, editUrl(assignment));
  await expect(page.getByRole("toolbar", { name: "עיצוב טקסט" })).toBeVisible();
  return { students, assignment };
};

const fromApi = (page: Page, assignment: TTeacherAssignment): Promise<TTeacherAssignment | undefined> =>
  getAssignmentById(page.request, assignment.id);

// The assignment, as the API shows it, must still be exactly what it was.
const expectUnchanged = async (page: Page, assignment: TTeacherAssignment): Promise<void> => {
  expect(await fromApi(page, assignment)).toEqual(assignment);
};

// Answers only the PUT request of this assignment, so the page can still load normally.
const routePut = (page: Page, assignment: TTeacherAssignment, handler: Parameters<Page["route"]>[1]) =>
  page.route(apiUrl(assignment), (route) =>
    route.request().method() === "PUT" ? handler(route, route.request()) : route.continue(),
  );

const fulfillJson = (status: number, body: unknown): Parameters<Page["route"]>[1] => (route) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test.describe("edit assignment: the page", () => {
  test("is filled with the assignment's current values", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);

    await expect(page.getByRole("heading", { name: "עריכת מטלה" })).toBeVisible();
    await expect(titleField(page)).toHaveValue(assignment.title);
    await expect(dueDateField(page)).toHaveValue("2030-06-15");
    await expect(studentBox(page, students[0].name)).toBeChecked();
    await expect(studentBox(page, students[1].name)).not.toBeChecked();
    await expect(editor(page).locator("h2")).toHaveText("הנחיות");
    await expect(editor(page).locator("strong")).toHaveText("מקורי");
    await expect(saveButton(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toHaveCount(0);
  });

  test("the cancel link goes back to the list and changes nothing", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await titleField(page).fill(uniqueTitle());

    await page.getByRole("link", { name: "ביטול" }).click();

    await expect(page).toHaveURL(LIST_URL);
    await expectUnchanged(page, assignment);
  });
});

test.describe("edit assignment: validation", () => {
  test("clearing the title, the date and the students shows the errors, keeps the page, and changes nothing", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    await titleField(page).fill("");
    await dueDateField(page).fill("");
    await studentBox(page, students[0].name).uncheck();

    await save(page);

    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();
    await expect(page.getByText(DATE_INVALID)).toBeVisible();
    await expect(page.getByText(STUDENTS_REQUIRED)).toBeVisible();
    await expect(titleField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(editUrl(assignment));
    await expectUnchanged(page, assignment);
  });

  test("shows the message only for the field with a problem, and keeps what was typed and chosen", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    await titleField(page).fill("א");
    await dueDateField(page).fill("2031-02-03");
    await studentBox(page, students[1].name).check();

    await save(page);

    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();
    await expect(page.getByText(DATE_INVALID)).toHaveCount(0);
    await expect(page.getByText(STUDENTS_REQUIRED)).toHaveCount(0);
    await expect(titleField(page)).toHaveValue("א");
    await expect(dueDateField(page)).toHaveValue("2031-02-03");
    await expect(studentBox(page, students[1].name)).toBeChecked();
    await expectUnchanged(page, assignment);
  });

  test("the errors go away after the problems are fixed and the form is saved", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await titleField(page).fill("");
    await save(page);
    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();
    const title = uniqueTitle();

    await titleField(page).fill(title);
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await fromApi(page, assignment))?.title).toBe(title);
  });
});

test.describe("edit assignment: saving", () => {
  test("a new title: goes to the list, the row shows it, and the old title is gone", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    const title = uniqueTitle();

    await titleField(page).fill(title);
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, title)).toBeVisible(SAVED);
    await expect(assignmentRow(page, assignment.title)).toHaveCount(0);
    expect((await fromApi(page, assignment))?.title).toBe(title);
  });

  test("a new due date is saved and shown in the list", async ({ page }) => {
    const { assignment } = await openEditPage(page);

    await dueDateField(page).fill("2031-02-03");
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, assignment.title).locator("td").nth(1)).toHaveText(formatDate("2031-02-03"), SAVED);
    expect((await fromApi(page, assignment))?.dueDate).toBe("2031-02-03");
  });

  test("a changed description is saved with its formatting", async ({ page }) => {
    const { assignment } = await openEditPage(page);

    await editor(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" ותוספת");
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await fromApi(page, assignment);
    expect(saved?.description).toContain("<h2>הנחיות</h2>");
    expect(saved?.description).toContain("<strong>");
    expect(saved?.description).toContain("ותוספת");
  });

  test("an emptied description is saved as empty", async ({ page }) => {
    const { assignment } = await openEditPage(page);

    await editor(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await fromApi(page, assignment))?.description).toBe("");
  });

  test("a student can be added, and starts as TODO", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);

    await studentBox(page, students[1].name).check();
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await fromApi(page, assignment);
    expect(saved?.students.map(({ name }) => name).sort()).toEqual([students[0].name, students[1].name].sort());
    expect(saved?.students.find(({ studentId }) => studentId === students[1].id)).toMatchObject({ status: "TODO", grade: null, file: null });
    await expect(assignmentRow(page, assignment.title).locator("td").nth(2)).toHaveText("2", SAVED);
  });

  test("a student who did not submit can be replaced by another", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);

    await studentBox(page, students[0].name).uncheck();
    await studentBox(page, students[1].name).check();
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await fromApi(page, assignment))?.students.map(({ name }) => name)).toEqual([students[1].name]);
  });

  test("a student who stays keeps the file, the grade and the status", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: 85, mimeType: "application/pdf" });
    const title = uniqueTitle();

    await titleField(page).fill(title);
    await studentBox(page, students[1].name).check();
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await fromApi(page, assignment);
    expect(saved?.title).toBe(title);
    expect(saved?.students.find(({ studentId }) => studentId === students[0].id)).toMatchObject({
      status: "CHECKED",
      grade: 85,
      submittedAt: "2030-06-01",
      file: { name: "עבודה.pdf", kind: "pdf" },
    });
  });

  test("saving without changes works, and keeps the assignment", async ({ page }) => {
    const { assignment } = await openEditPage(page);

    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expectUnchanged(page, assignment);
  });

  test("the number of assignments does not change", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    const before: number = (await getAssignmentList(page.request)).filter(({ title }) => title === assignment.title).length;

    await titleField(page).fill(uniqueTitle());
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect(before).toBe(1);
    expect(await fromApi(page, assignment)).toBeDefined();
  });

  test("the change is still there after a reload", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    const title = uniqueTitle();
    await titleField(page).fill(title);
    await save(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);

    await page.reload();

    await expect(assignmentRow(page, title)).toBeVisible();
    await page.goto(editUrl(assignment));
    await expect(titleField(page)).toHaveValue(title);
  });

  test("opening the edit page again after saving shows the saved values, and the save button works", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    const title = uniqueTitle();
    await titleField(page).fill(title);
    await dueDateField(page).fill("2031-02-03");
    await studentBox(page, students[1].name).check();
    await editor(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" ותוספת");
    await save(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, title)).toBeVisible(SAVED);

    await page.getByRole("link", { name: `עריכה עבור ${title}` }).click();

    await expect(page).toHaveURL(editUrl(assignment));
    await expect(titleField(page)).toHaveValue(title);
    await expect(dueDateField(page)).toHaveValue("2031-02-03");
    await expect(studentBox(page, students[0].name)).toBeChecked();
    await expect(studentBox(page, students[1].name)).toBeChecked();
    await expect(page.getByText("נבחרו 2 תלמידים")).toBeVisible();
    await expect(editor(page)).toContainText("ותוספת");
    await expect(saveButton(page)).toBeEnabled();
  });

  test("an assignment can be edited twice in a row, each time from its edit link", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    const first = uniqueTitle();
    await titleField(page).fill(first);
    await save(page);
    await expect(assignmentRow(page, first)).toBeVisible(SAVED);
    await page.getByRole("link", { name: `עריכה עבור ${first}` }).click();
    const second = uniqueTitle();

    await titleField(page).fill(second);
    await studentBox(page, students[1].name).check();
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, second)).toBeVisible(SAVED);
    const saved = await fromApi(page, assignment);
    expect(saved?.title).toBe(second);
    expect(saved?.students).toHaveLength(2);
  });

  test("the assignment's page shows the change after saving", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await page.goto(`/dashboard/assignments/${assignment.id}`);
    await expect(page.getByRole("heading", { name: assignment.title, level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "עריכת המטלה" }).first().click();
    const title = uniqueTitle();

    await titleField(page).fill(title);
    await save(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);
    await assignmentRow(page, title).getByRole("link", { name: `פרטים עבור ${title}` }).click();

    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: assignment.title, level: 1 })).toHaveCount(0);
  });

  test("while saving, the submit button is disabled and says so, until the page changes", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await routePut(page, assignment, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await save(page);

    await expect(page.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(page).toHaveURL(LIST_URL, SAVED);
  });

  test("the form is not sent twice by a second click while saving", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    let puts = 0;
    await routePut(page, assignment, async (route) => {
      puts += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await save(page);
    await page.getByRole("button", { name: "שומר..." }).click({ force: true, timeout: 1000 }).catch(() => {});

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect(puts).toBe(1);
  });

  test("sends the four fields to this assignment's endpoint with PUT", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    let sent: Record<string, unknown> | null = null;
    let method = "";
    await routePut(page, assignment, (route, request) => {
      sent = request.postDataJSON();
      method = request.method();
      return route.continue();
    });
    const title = uniqueTitle();
    await titleField(page).fill(title);

    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect(method).toBe("PUT");
    expect(Object.keys(sent ?? {}).sort()).toEqual(["description", "dueDate", "studentIds", "title"]);
    expect(sent).toMatchObject({ title, dueDate: "2030-06-15", studentIds: [students[0].id], description: DESCRIPTION });
  });
});

test.describe("edit assignment: errors from the server", () => {
  test("removing a student who already submitted shows the server's message, and changes nothing", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });
    const before: TTeacherAssignment | undefined = await fromApi(page, assignment);
    await titleField(page).fill(uniqueTitle());
    await studentBox(page, students[0].name).uncheck();
    await studentBox(page, students[1].name).check();

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.assignmentStudentSubmitted)).toBeVisible();
    await expect(page).toHaveURL(editUrl(assignment));
    await expect(saveButton(page)).toBeEnabled();
    expect(await fromApi(page, assignment)).toEqual(before);
  });

  test("after that message the form can be fixed and saved", async ({ page }) => {
    const { students, assignment } = await openEditPage(page);
    await submitPart(assignment.id, students[0].id, { submittedAt: "2030-06-01T10:00:00Z", grade: null, mimeType: "application/pdf" });
    await studentBox(page, students[0].name).uncheck();
    await studentBox(page, students[1].name).check();
    await save(page);
    await expect(page.getByText(ERROR_MESSAGES.assignmentStudentSubmitted)).toBeVisible();
    const title = uniqueTitle();

    await studentBox(page, students[0].name).check();
    await titleField(page).fill(title);
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await fromApi(page, assignment);
    expect(saved?.title).toBe(title);
    expect(saved?.students.map(({ name }) => name).sort()).toEqual([students[0].name, students[1].name].sort());
  });

  test("when the assignment was deleted meanwhile, shows the message and stays on the page", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await removeViaApi(page.request, `/api/assignments/${assignment.id}`);

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.assignmentNotFound)).toBeVisible();
    await expect(page).toHaveURL(editUrl(assignment));
  });

  test("when a chosen student was deleted meanwhile, shows the message and keeps the form", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    const temporary = await createStudent(page.request);
    await page.reload();
    await expect(page.getByRole("toolbar", { name: "עיצוב טקסט" })).toBeVisible();
    await studentBox(page, temporary.name).check();
    await removeViaApi(page.request, `/api/students/${temporary.id}`);
    const title = uniqueTitle();
    await titleField(page).fill(title);

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.studentNotFound)).toBeVisible();
    await expect(titleField(page)).toHaveValue(title);
    await expectUnchanged(page, assignment);
  });

  test("shows the field errors that the server sends", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await routePut(
      page,
      assignment,
      fulfillJson(400, { error: ERROR_MESSAGES.validation, fields: { title: ["הודעה מהשרת על השם"], studentIds: ["הודעה מהשרת על התלמידים"] } }),
    );

    await save(page);

    await expect(page.getByText("הודעה מהשרת על השם")).toBeVisible();
    await expect(page.getByText("הודעה מהשרת על התלמידים")).toBeVisible();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  });

  test("shows the generic message for a server error", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    await routePut(page, assignment, fulfillJson(500, { error: ERROR_MESSAGES.internal }));

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page).toHaveURL(editUrl(assignment));
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    let failNext = true;
    await routePut(page, assignment, (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    const title = uniqueTitle();
    await titleField(page).fill(title);

    await save(page);
    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(titleField(page)).toHaveValue(title);
    await expect(saveButton(page)).toBeEnabled();

    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await fromApi(page, assignment))?.title).toBe(title);
  });
});

test.describe("edit assignment: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("the page fits the screen, and the assignment can be changed", async ({ page }) => {
    const { assignment } = await openEditPage(page);
    const title = uniqueTitle();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await titleField(page).fill(title);
    await saveButton(page).scrollIntoViewIfNeeded();
    await save(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await fromApi(page, assignment))?.title).toBe(title);
  });
});
