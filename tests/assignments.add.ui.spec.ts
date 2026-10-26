import { expect, test, type Locator, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { formatDate } from "../helpers/date";
import { WRITE_SEED } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import {
  createStudent,
  getAssignmentsWithStudents,
  getStudentList,
  gotoHydrated,
  randomLetters,
  signInAs,
} from "./helpers";

// These tests add assignments through the form, so they only use a write teacher (see helpers): the tests that
// read the demo teachers' assignments are not affected. The global setup removes what they create before a run.
const LIST_URL = "/dashboard/assignments";
const NEW_URL = "/dashboard/assignments/new";
const [FIRST_STUDENT, SECOND_STUDENT] = WRITE_SEED.classes.flatMap(({ students }) => students).map(({ name }) => name);
const SECOND_CLASS: string = WRITE_SEED.classes[1].name;

const TITLE_TOO_SHORT = "שם המטלה חייב להכיל לפחות 2 תווים";
const TITLE_NO_LETTERS = "שם המטלה חייב להכיל אותיות או ספרות";
const TITLE_TOO_LONG = "שם המטלה יכול להכיל עד 100 תווים";
const DATE_INVALID = "תאריך ההגשה אינו תקין";
const STUDENTS_REQUIRED = "יש לבחור לפחות תלמיד אחד";

// Saving goes through the API and then to the list, which can take longer than 5 seconds when many tests
// run at once.
const SAVED = { timeout: 20_000 };

const uniqueTitle = (): string => `מטלה ${randomLetters(10)}`;

const titleField = (page: Page): Locator => page.getByLabel("שם המטלה");
const dueDateField = (page: Page): Locator => page.getByLabel("תאריך הגשה");
const studentBox = (page: Page, name: string): Locator => page.getByRole("checkbox", { name, exact: true });
const classBox = (page: Page, name: string): Locator => page.getByRole("checkbox", { name: `בחירת כל כיתה ${name}`, exact: true });
const editor = (page: Page): Locator => page.getByRole("textbox", { name: "תיאור המטלה" });
const submitButton = (page: Page): Locator => page.getByRole("button", { name: "הוספה", exact: true });
const hiddenHtml = (page: Page): Locator => page.locator('input[name="description"]');

const openAddPage = async (page: Page): Promise<void> => {
  await signInAs(page.request, WRITE_SEED);
  await gotoHydrated(page, NEW_URL);
  // The editor is created after the page loads, so its toolbar shows up a moment later.
  await expect(page.getByRole("toolbar", { name: "עיצוב טקסט" })).toBeVisible();
};

type TFormValues = { title: string; dueDate?: string; students?: string[]; description?: string };

const fillForm = async (page: Page, { title, dueDate = "2030-06-15", students = [FIRST_STUDENT], description }: TFormValues): Promise<void> => {
  await titleField(page).fill(title);
  await dueDateField(page).fill(dueDate);
  for (const name of students) await studentBox(page, name).check();
  if (description) {
    await editor(page).click();
    await page.keyboard.type(description);
  }
};

const validValues = (): TFormValues => ({ title: uniqueTitle() });

const add = (page: Page): Promise<void> => submitButton(page).click();

// Tests run in parallel on the same teacher, so a global count is not stable. Checks use the assignment that a
// test created, found by its random title through the API.
const findCreated = async (page: Page, title: string): Promise<TTeacherAssignment | undefined> =>
  (await getAssignmentsWithStudents(page.request)).find((assignment) => assignment.title === title);

const countNamed = async (page: Page, title: string): Promise<number> =>
  (await getAssignmentsWithStudents(page.request)).filter((assignment) => assignment.title === title).length;

const assignmentRow = (page: Page, title: string): Locator => page.locator("tbody tr:visible").filter({ hasText: title });

// Answers only the POST request, so the page can still load normally.
const routePost = (page: Page, handler: Parameters<Page["route"]>[1]) =>
  page.route("**/api/assignments", (route) =>
    route.request().method() === "POST" ? handler(route, route.request()) : route.continue(),
  );

const fulfillJson = (status: number, body: unknown): Parameters<Page["route"]>[1] => (route) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test.describe("add assignment: the page", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("starts empty: no title, no date, no student chosen, and an add button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "מטלה חדשה" })).toBeVisible();
    await expect(titleField(page)).toHaveValue("");
    await expect(titleField(page)).toBeFocused();
    await expect(dueDateField(page)).toHaveValue("");
    await expect(page.locator('input[name="studentIds"]:checked')).toHaveCount(0);
    expect(await hiddenHtml(page).inputValue()).toBe("");
    await expect(submitButton(page)).toBeEnabled();
  });

  test("the cancel link goes back to the list and adds nothing", async ({ page }) => {
    const values = validValues();
    await fillForm(page, values);

    await page.getByRole("link", { name: "ביטול" }).click();

    await expect(page).toHaveURL(LIST_URL);
    expect(await countNamed(page, values.title)).toBe(0);
  });
});

test.describe("add assignment: validation", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("an empty form shows an error under the title, the students and the date, and stays on the page", async ({ page }) => {
    await add(page);

    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();
    await expect(page.getByText(DATE_INVALID)).toBeVisible();
    await expect(page.getByText(STUDENTS_REQUIRED)).toBeVisible();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
    await expect(titleField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(dueDateField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(NEW_URL);
  });

  test("the description is optional: it never gets an error", async ({ page }) => {
    await add(page);

    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();
    await expect(page.getByText("התיאור")).toHaveCount(0);
  });

  const TITLE_PROBLEMS: [string, string, string][] = [
    ["is one character", "א", TITLE_TOO_SHORT],
    ["has no letter or digit", "!!", TITLE_NO_LETTERS],
    ["is over 100 characters", "א".repeat(101), TITLE_TOO_LONG],
  ];

  for (const [label, title, message] of TITLE_PROBLEMS) {
    test(`shows the matching message when the title ${label}, and only for the title`, async ({ page }) => {
      await fillForm(page, { title });

      await add(page);

      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByText(DATE_INVALID)).toHaveCount(0);
      await expect(page.getByText(STUDENTS_REQUIRED)).toHaveCount(0);
      await expect(page).toHaveURL(NEW_URL);
    });
  }

  test("shows the students message when no student was chosen, and only for the students", async ({ page }) => {
    await fillForm(page, { title: uniqueTitle(), students: [] });

    await add(page);

    await expect(page.getByText(STUDENTS_REQUIRED)).toBeVisible();
    await expect(page.getByText(TITLE_TOO_SHORT)).toHaveCount(0);
    await expect(page.getByText(DATE_INVALID)).toHaveCount(0);
  });

  test("an invalid form saves nothing, and keeps everything that was typed and chosen", async ({ page }) => {
    const title = "!!";
    await fillForm(page, { title, dueDate: "2031-02-03", students: [FIRST_STUDENT, SECOND_STUDENT], description: "הנחיות חשובות" });

    await add(page);

    await expect(page.getByText(TITLE_NO_LETTERS)).toBeVisible();
    await expect(titleField(page)).toHaveValue(title);
    await expect(dueDateField(page)).toHaveValue("2031-02-03");
    await expect(studentBox(page, FIRST_STUDENT)).toBeChecked();
    await expect(studentBox(page, SECOND_STUDENT)).toBeChecked();
    await expect(editor(page)).toContainText("הנחיות חשובות");
    expect(await countNamed(page, title)).toBe(0);
  });

  test("shows one message per field, never a stack", async ({ page }) => {
    await add(page);

    await expect(page.getByText(TITLE_TOO_SHORT)).toHaveCount(1);
    await expect(page.getByText(TITLE_NO_LETTERS)).toHaveCount(0);
    await expect(page.getByText(DATE_INVALID)).toHaveCount(1);
    await expect(page.getByText(STUDENTS_REQUIRED)).toHaveCount(1);
  });

  test("the old errors are cleared when the next attempt starts, and the fixed form is saved", async ({ page }) => {
    const values = validValues();
    await add(page);
    await expect(page.getByText(TITLE_TOO_SHORT)).toBeVisible();

    await fillForm(page, values);
    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, values.title)).toBeVisible(SAVED);
    expect(await countNamed(page, values.title)).toBe(1);
  });
});

test.describe("add assignment: saving", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("saves the assignment: goes to the list, and the new row shows with its date and who submitted", async ({ page }) => {
    const values: TFormValues = { title: uniqueTitle(), dueDate: "2031-02-03", students: [FIRST_STUDENT, SECOND_STUDENT] };
    await fillForm(page, values);

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const row = assignmentRow(page, values.title);
    await expect(row).toBeVisible(SAVED);
    await expect(row.locator("td").nth(1)).toHaveText(formatDate("2031-02-03"));
    await expect(row.locator("td").nth(2)).toHaveText("2");
    await expect(row.locator("td").nth(3)).toHaveText("0 מתוך 2");
  });

  test("saves what was typed, with every student chosen starting as TODO", async ({ page }) => {
    const values: TFormValues = { title: uniqueTitle(), dueDate: "2031-02-03", students: [FIRST_STUDENT, SECOND_STUDENT] };
    await fillForm(page, values);
    await add(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);

    const saved = await findCreated(page, values.title);

    expect(saved).toMatchObject({ title: values.title, dueDate: "2031-02-03", description: "" });
    expect(saved?.students.map(({ name }) => name).sort()).toEqual([FIRST_STUDENT, SECOND_STUDENT].sort());
    for (const part of saved?.students ?? []) expect(part).toMatchObject({ status: "TODO", grade: null, file: null });
  });

  test("saves only the students that were chosen", async ({ page }) => {
    const values: TFormValues = { ...validValues(), students: [SECOND_STUDENT] };
    await fillForm(page, values);
    await add(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);

    const saved = await findCreated(page, values.title);

    expect(saved?.students.map(({ name }) => name)).toEqual([SECOND_STUDENT]);
  });

  test("a whole class can be chosen with its checkbox, and the students of it are saved", async ({ page }) => {
    const title = uniqueTitle();
    await titleField(page).fill(title);
    await dueDateField(page).fill("2030-06-15");
    await classBox(page, SECOND_CLASS).check();
    await expect(studentBox(page, SECOND_STUDENT)).toBeChecked();

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await findCreated(page, title);
    expect(saved?.students.map(({ name }) => name)).toContain(SECOND_STUDENT);
    expect(saved?.students.every(({ className }) => className === SECOND_CLASS)).toBe(true);
    expect(saved?.students.map(({ name }) => name)).not.toContain(FIRST_STUDENT);
  });

  test("saves the description with its formatting", async ({ page }) => {
    const values = validValues();
    await fillForm(page, values);
    await editor(page).click();
    await page.getByRole("toolbar", { name: "עיצוב טקסט" }).getByRole("button", { name: "מודגש", exact: true }).click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type("חשוב מאוד");

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    const saved = await findCreated(page, values.title);
    expect(saved?.description).toBe("<p><strong>חשוב מאוד</strong></p>");
  });

  test("the description can be left empty", async ({ page }) => {
    const values = validValues();
    await fillForm(page, values);

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await findCreated(page, values.title))?.description).toBe("");
  });

  test("the spaces around the title are not saved", async ({ page }) => {
    const title = uniqueTitle();
    await fillForm(page, { title: `   ${title}   ` });

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect((await findCreated(page, title))?.title).toBe(title);
  });

  test("the saved assignment opens from the list, and is still there after a reload", async ({ page }) => {
    const values: TFormValues = { ...validValues(), description: "הנחיות לבדיקה" };
    await fillForm(page, values);
    await add(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);

    await page.reload();
    await assignmentRow(page, values.title).getByRole("link", { name: `פרטים עבור ${values.title}` }).click();

    await expect(page.getByRole("heading", { name: values.title, level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "פרטי המטלה" })).toContainText("הנחיות לבדיקה");
    await expect(page.locator("tbody tr:visible")).toHaveCount(1);
  });

  test("the add page is empty again after saving one, also when it is opened with the link", async ({ page }) => {
    await fillForm(page, { ...validValues(), students: [FIRST_STUDENT, SECOND_STUDENT], description: "טיוטה" });
    await add(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);

    await page.getByRole("link", { name: "הוספת מטלה" }).click();

    await expect(page).toHaveURL(NEW_URL);
    await expect(titleField(page)).toHaveValue("");
    await expect(dueDateField(page)).toHaveValue("");
    await expect(page.locator('input[name="studentIds"]:checked')).toHaveCount(0);
    await expect(page.getByText("לא נבחרו תלמידים")).toBeVisible();
    await expect(editor(page)).not.toContainText("טיוטה");
    expect(await hiddenHtml(page).inputValue()).toBe("");
    await expect(submitButton(page)).toBeEnabled();
  });

  test("an empty add page can be saved a second time", async ({ page }) => {
    await fillForm(page, validValues());
    await add(page);
    await expect(page).toHaveURL(LIST_URL, SAVED);
    await page.getByRole("link", { name: "הוספת מטלה" }).click();
    const second = validValues();

    await fillForm(page, second);
    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, second.title)).toBeVisible(SAVED);
    expect(await countNamed(page, second.title)).toBe(1);
  });

  test("a draft that was not saved is still there when the page is opened again", async ({ page }) => {
    const title = uniqueTitle();
    await fillForm(page, { title, students: [SECOND_STUDENT] });
    await page.getByRole("link", { name: "ביטול" }).click();
    await expect(page).toHaveURL(LIST_URL);

    await page.getByRole("link", { name: "הוספת מטלה" }).click();

    await expect(titleField(page)).toHaveValue(title);
    await expect(studentBox(page, SECOND_STUDENT)).toBeChecked();
    expect(await countNamed(page, title)).toBe(0);
  });

  test("while saving, the submit button is disabled and says so, until the page changes", async ({ page }) => {
    await routePost(page, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await fillForm(page, validValues());

    await add(page);

    await expect(page.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(page).toHaveURL(LIST_URL, SAVED);
  });

  test("the form is not sent twice by a second click while saving", async ({ page }) => {
    const values = validValues();
    let posts = 0;
    await routePost(page, async (route) => {
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await fillForm(page, values);

    await add(page);
    await page.getByRole("button", { name: "שומר..." }).click({ force: true, timeout: 1000 }).catch(() => {});

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect(posts).toBe(1);
    expect(await countNamed(page, values.title)).toBe(1);
  });

  test("sends exactly what the form has, as JSON, with the chosen students", async ({ page }) => {
    const values: TFormValues = { title: uniqueTitle(), dueDate: "2031-02-03", students: [FIRST_STUDENT, SECOND_STUDENT], description: "טקסט" };
    const students = await getStudentList(page.request);
    let sent: Record<string, unknown> | null = null;
    await routePost(page, (route, request) => {
      sent = request.postDataJSON();
      return route.continue();
    });
    await fillForm(page, values);

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    expect(Object.keys(sent ?? {}).sort()).toEqual(["description", "dueDate", "studentIds", "title"]);
    expect(sent).toMatchObject({ title: values.title, dueDate: "2031-02-03", description: "<p>טקסט</p>" });
    const ids = students.filter(({ name }) => [FIRST_STUDENT, SECOND_STUDENT].includes(name)).map(({ id }) => id).sort();
    expect(((sent as unknown as { studentIds: string[] }).studentIds).sort()).toEqual(ids);
  });
});

test.describe("add assignment: errors from the server", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("shows the server's message when a chosen student was deleted before saving, and keeps the form", async ({ page }) => {
    const temporary = await createStudent(page.request);
    await gotoHydrated(page, NEW_URL);
    await expect(page.getByRole("toolbar", { name: "עיצוב טקסט" })).toBeVisible();
    const values = validValues();
    await fillForm(page, { ...values, students: [FIRST_STUDENT, temporary.name] });
    expect((await page.request.delete(`/api/students/${temporary.id}`)).status()).toBe(200);

    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.studentNotFound)).toBeVisible();
    await expect(page).toHaveURL(NEW_URL);
    await expect(titleField(page)).toHaveValue(values.title);
    expect(await countNamed(page, values.title)).toBe(0);
  });

  test("shows the server's message for an expired session", async ({ page }) => {
    await routePost(page, fulfillJson(401, { error: ERROR_MESSAGES.unauthorized }));
    await fillForm(page, validValues());

    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.unauthorized)).toBeVisible();
    await expect(page).toHaveURL(NEW_URL);
  });

  test("shows the generic message for a server error", async ({ page }) => {
    await routePost(page, fulfillJson(500, { error: ERROR_MESSAGES.internal }));
    await fillForm(page, validValues());

    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page).toHaveURL(NEW_URL);
  });

  test("shows the field errors that the server sends", async ({ page }) => {
    await routePost(
      page,
      fulfillJson(400, {
        error: ERROR_MESSAGES.validation,
        fields: { title: ["הודעה מהשרת על השם"], description: ["הודעה מהשרת על התיאור"] },
      }),
    );
    await fillForm(page, validValues());

    await add(page);

    await expect(page.getByText("הודעה מהשרת על השם")).toBeVisible();
    await expect(page.getByText("הודעה מהשרת על התיאור")).toBeVisible();
    await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({ page }) => {
    let failNext = true;
    await routePost(page, (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    const values = validValues();
    await fillForm(page, values);

    await add(page);
    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(titleField(page)).toHaveValue(values.title);
    await expect(submitButton(page)).toBeEnabled();

    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, values.title)).toBeVisible(SAVED);
    expect(await countNamed(page, values.title)).toBe(1);
  });
});

test.describe("add assignment: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("the page fits the screen, and an assignment can be added", async ({ page }) => {
    await openAddPage(page);
    const values = validValues();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await fillForm(page, values);
    await submitButton(page).scrollIntoViewIfNeeded();
    await add(page);

    await expect(page).toHaveURL(LIST_URL, SAVED);
    await expect(assignmentRow(page, values.title)).toBeVisible(SAVED);
  });
});

test.describe("add assignment: access", () => {
  test("without a session it goes to the sign-in page", async ({ page }) => {
    await page.goto(NEW_URL);

    await expect(page).toHaveURL(/\/auth$/);
  });
});
