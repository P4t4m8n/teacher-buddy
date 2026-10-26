import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { formatDate } from "../helpers/date";
import { WRITE_SEED } from "../prisma/seed-data";
import type { TAssignmentStudent, TTeacherAssignment } from "../types/assignment.type";
import type { TStudent } from "../types/student.type";
import { getAssignmentById, getSeededStudentList, gotoHydrated, randomLetters, signInAs, withTestDb } from "./helpers";

// These tests save files and grades, so they only use a write teacher and only change assignments they created
// themselves (see helpers). The global setup removes what they create before a run.
const LIST_URL = "/dashboard/assignments";
const GRADE_MESSAGE = "הציון חייב להיות מספר שלם בין 0 ל-100";

// Saving goes through the API and then refreshes the page, which can take longer than 5 seconds when many
// tests run at once.
const SAVED = { timeout: 20_000 };

const PDF = (text: string, size: number = 300): { name: string; mimeType: string; buffer: Buffer } => ({
  name: `${text}.pdf`,
  mimeType: "application/pdf",
  buffer: Buffer.concat([Buffer.from(`%PDF-1.7\n${text}\n`), Buffer.alloc(size)]),
});
const PNG = {
  name: "scan.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

const israelToday = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

type TFixture = { students: TStudent[]; assignment: TTeacherAssignment };

// An assignment the test owns, given to both seeded students of the write teacher (both TODO).
const createFixture = async (page: Page): Promise<TFixture> => {
  await signInAs(page.request, WRITE_SEED);
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

const partUrl = (assignment: TTeacherAssignment, student: TStudent, part: "file" | "grade"): string =>
  `/api/assignments/${assignment.id}/students/${student.id}/${part}`;

// Gives a student a file (and a grade) through the API, before the page is opened.
const prepare = async (page: Page, { assignment, students }: TFixture, grade: number | null | "none" = "none"): Promise<void> => {
  if (grade === "none") return;
  const file = PDF("עבודה-קיימת");
  expect((await page.request.put(partUrl(assignment, students[0], "file"), { multipart: { file } })).status()).toBe(200);
  if (grade !== null) expect((await page.request.put(partUrl(assignment, students[0], "grade"), { data: { grade } })).status()).toBe(200);
};

const partOf = async (page: Page, { assignment }: TFixture, student: TStudent): Promise<TAssignmentStudent> => {
  const saved: TTeacherAssignment | undefined = await getAssignmentById(page.request, assignment.id);
  const part = saved?.students.find(({ studentId }) => studentId === student.id);
  if (!part) throw new Error("The student is not in the assignment");
  return part;
};

const storedBytes = async (page: Page, { assignment }: TFixture, student: TStudent): Promise<Buffer> =>
  (await page.request.get(partUrl(assignment, student, "file"))).body();

// ----- The assignment page -----

const openAssignmentPage = async (page: Page, { assignment }: TFixture): Promise<void> => {
  await gotoHydrated(page, `/dashboard/assignments/${assignment.id}`);
};

const assignmentRow = (page: Page, student: TStudent): Locator => page.locator("tbody tr:visible").filter({ hasText: student.name });

const openFromAssignmentPage = async (page: Page, { assignment }: TFixture, student: TStudent): Promise<Locator> => {
  await assignmentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();
  const dialog = page.getByRole("dialog", { name: `${student.name} - ${assignment.title}` });
  await expect(dialog).toBeVisible();
  return dialog;
};

// The status, the upload date and the grade of a row of the assignment page.
const expectAssignmentRow = async (page: Page, student: TStudent, status: string, date: string, grade: string): Promise<void> => {
  const cells = assignmentRow(page, student).locator("td");
  await expect(cells.nth(2)).toHaveText(status, SAVED);
  await expect(cells.nth(3)).toHaveText(date, SAVED);
  await expect(cells.nth(4)).toHaveText(grade, SAVED);
};

// ----- The student page -----

const openStudentPage = async (page: Page, student: TStudent): Promise<void> => {
  await gotoHydrated(page, `/dashboard/students/${student.id}`);
};

const studentRow = (page: Page, assignment: TTeacherAssignment): Locator =>
  page.locator("tbody tr:visible").filter({ hasText: assignment.title });

const openFromStudentPage = async (page: Page, assignment: TTeacherAssignment): Promise<Locator> => {
  await studentRow(page, assignment).locator("td").nth(2).click();
  const dialog = page.getByRole("dialog", { name: assignment.title });
  await expect(dialog).toBeVisible();
  return dialog;
};

const fileInput = (dialog: Locator): Locator => dialog.locator('input[type="file"]');
const gradeField = (dialog: Locator): Locator => dialog.getByLabel("ציון");
const saveButton = (dialog: Locator): Locator => dialog.getByRole("button", { name: "שמירה", exact: true });
const alertIn = (dialog: Locator): Locator => dialog.locator("form").getByRole("alert");

// What the page sends to save a student's file or grade, as "PUT file" or "PUT grade".
const trackSaves = (page: Page): string[] => {
  const sent: string[] = [];
  page.on("request", (request) => {
    const match = /\/api\/assignments\/[0-9a-f-]{36}\/students\/[0-9a-f-]{36}\/(file|grade)$/.exec(request.url());
    if (match && request.method() !== "GET") sent.push(`${request.method()} ${match[1]}`);
  });
  return sent;
};

const routePart = (page: Page, part: "file" | "grade", handler: (route: Route) => Promise<void> | void) =>
  page.route(`**/api/assignments/*/students/*/${part}`, (route) =>
    route.request().method() === "PUT" ? handler(route) : route.continue(),
  );

const fulfillJson = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test.describe("student modal on the assignment page: saving a file", () => {
  test("a file for a student who did not submit: the modal closes, and the row shows submitted, with today's date", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("עבודה-חדשה");

    await fileInput(dialog).setInputFiles(file);
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    await expectAssignmentRow(page, student, "הוגשה", formatDate(israelToday()), "-");
    await expect(page).toHaveURL(`/dashboard/assignments/${fixture.assignment.id}`);
  });

  test("saves the real bytes, the name and the type", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("שמורה", 5000);

    await fileInput(dialog).setInputFiles(file);
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    const part = await partOf(page, fixture, student);
    expect(part).toMatchObject({ status: "SUBMITTED", grade: null, file: { name: file.name, kind: "pdf" } });
    expect((await storedBytes(page, fixture, student)).equals(file.buffer)).toBe(true);
  });

  test("an image is saved and shown as an image", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await fileInput(dialog).setInputFiles(PNG);
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect((await partOf(page, fixture, student)).file).toMatchObject({ name: "scan.png", kind: "image" });
    const reopened = await openFromAssignmentPage(page, fixture, student);
    await expect(reopened.getByRole("img", { name: "scan.png" })).toHaveAttribute("src", partUrl(fixture.assignment, student, "file"));
  });

  test("only the file is sent: no grade request when the grade was not touched", async ({ page }) => {
    const fixture = await createFixture(page);
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

    await fileInput(dialog).setInputFiles(PDF("רק-קובץ"));
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect(sent).toEqual(["PUT file"]);
  });

  test("the other student is not touched", async ({ page }) => {
    const fixture = await createFixture(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

    await fileInput(dialog).setInputFiles(PDF("לאחד"));
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect(await partOf(page, fixture, fixture.students[1])).toMatchObject({ status: "TODO", file: null, submittedAt: null });
    await expectAssignmentRow(page, fixture.students[1], "לביצוע", "-", "-");
  });

  test("a new file for a checked student replaces the file and keeps the status and the grade", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 85);
    const [student] = fixture.students;
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("מתוקן");

    await fileInput(dialog).setInputFiles(file);
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect(sent).toEqual(["PUT file"]);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 85, file: { name: file.name } });
    expect((await storedBytes(page, fixture, student)).equals(file.buffer)).toBe(true);
    await expectAssignmentRow(page, student, "נבדקה", formatDate(israelToday()), "85");
  });

  test("the saved file shows in the modal when it is opened again", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const first = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("לפתיחה-חוזרת");
    await fileInput(first).setInputFiles(file);
    await saveButton(first).click();
    await expect(first).toBeHidden(SAVED);

    const reopened = await openFromAssignmentPage(page, fixture, student);

    await expect(reopened.locator(`iframe[title="${file.name}"]`)).toHaveAttribute("src", partUrl(fixture.assignment, student, "file"));
    await expect(reopened.locator("dd").nth(0)).toHaveText("הוגשה");
    await expect(reopened.getByLabel("החלפת קובץ")).toBeVisible();
    await expect(gradeField(reopened)).toBeEnabled();
  });
});

test.describe("student modal on the assignment page: saving a grade", () => {
  test("a grade for a student who submitted: the row shows checked and the grade", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await gradeField(dialog).fill("77");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    await expectAssignmentRow(page, student, "נבדקה", formatDate(israelToday()), "77");
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 77 });
  });

  test("only the grade is sent: no file request when no file was picked", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

    await gradeField(dialog).fill("64");
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect(sent).toEqual(["PUT grade"]);
  });

  for (const value of [0, 100]) {
    test(`the grade ${value} is saved, also the lowest and the highest`, async ({ page }) => {
      const fixture = await createFixture(page);
      await prepare(page, fixture, null);
      await openAssignmentPage(page, fixture);
      const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

      await gradeField(dialog).fill(String(value));
      await saveButton(dialog).click();
      await expect(dialog).toBeHidden(SAVED);

      expect(await partOf(page, fixture, fixture.students[0])).toMatchObject({ status: "CHECKED", grade: value });
      await expect(assignmentRow(page, fixture.students[0]).locator("td").nth(4)).toHaveText(String(value), SAVED);
    });
  }

  test("an existing grade is changed, and stays checked", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 60);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    await expect(gradeField(dialog)).toHaveValue("60");

    await gradeField(dialog).fill("95");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 95 });
    await expect(assignmentRow(page, student).locator("td").nth(4)).toHaveText("95", SAVED);
  });

  test("clearing the grade sends null: the student is submitted again, with the file kept", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 88);
    const [student] = fixture.students;
    let body: unknown = null;
    await routePart(page, "grade", (route) => {
      body = route.request().postDataJSON();
      return route.continue();
    });
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await gradeField(dialog).fill("");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(body).toEqual({ grade: null });
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "SUBMITTED", grade: null, file: { kind: "pdf" } });
    await expectAssignmentRow(page, student, "הוגשה", formatDate(israelToday()), "-");
  });

  test("saving without a change sends nothing, and closes the modal", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 70);
    const before = await partOf(page, fixture, fixture.students[0]);
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(sent).toEqual([]);
    expect(await partOf(page, fixture, fixture.students[0])).toEqual(before);
  });

  test("a student with no file cannot be graded: the field is closed, and nothing can be sent for it", async ({ page }) => {
    const fixture = await createFixture(page);
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await expect(gradeField(dialog)).toBeDisabled();

    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(sent).toEqual([]);
    expect(await partOf(page, fixture, fixture.students[0])).toMatchObject({ status: "TODO", grade: null });
  });
});

test.describe("student modal on the assignment page: a file and a grade together", () => {
  test("a file and a grade for a student who did not submit are saved in one go: checked", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("ביחד");

    await fileInput(dialog).setInputFiles(file);
    await gradeField(dialog).fill("91");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(sent).toEqual(["PUT file", "PUT grade"]);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 91, file: { name: file.name } });
    await expectAssignmentRow(page, student, "נבדקה", formatDate(israelToday()), "91");
  });

  test("a new file and a changed grade for a checked student are both saved", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 50);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("חדש");

    await fileInput(dialog).setInputFiles(file);
    await gradeField(dialog).fill("75");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 75, file: { name: file.name } });
  });

  test("when the grade is refused after the file was saved, the modal stays with the message, and a new try does not upload the file again", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    const file = PDF("חלקי");

    await fileInput(dialog).setInputFiles(file);
    await gradeField(dialog).fill("150");
    await saveButton(dialog).click();

    await expect(dialog.getByText(GRADE_MESSAGE)).toBeVisible(SAVED);
    await expect(dialog).toBeVisible();
    await expect(gradeField(dialog)).toHaveValue("150");
    await expect(gradeField(dialog)).toHaveAttribute("aria-invalid", "true");
    await expect(saveButton(dialog)).toBeEnabled();
    // The file was saved, so the page shows that, and the modal does too.
    await expect(dialog.locator("dd").nth(0)).toHaveText("הוגשה", SAVED);
    expect((await partOf(page, fixture, student)).status).toBe("SUBMITTED");
    expect(sent).toEqual(["PUT file", "PUT grade"]);

    await gradeField(dialog).fill("80");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(sent).toEqual(["PUT file", "PUT grade", "PUT grade"]);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 80, file: { name: file.name } });
    await expectAssignmentRow(page, student, "נבדקה", formatDate(israelToday()), "80");
  });
});

test.describe("student modal on the assignment page: refused input", () => {
  test("a grade out of range shows the server's message under the field, keeps the modal, and saves nothing", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await gradeField(dialog).fill("150");
    await saveButton(dialog).click();

    await expect(dialog.getByText(GRADE_MESSAGE)).toBeVisible(SAVED);
    await expect(gradeField(dialog)).toHaveAttribute("aria-invalid", "true");
    await expect(gradeField(dialog)).toHaveValue("150");
    await expect(alertIn(dialog)).toHaveCount(0);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "SUBMITTED", grade: null });
  });

  for (const [label, value] of [["a decimal", "85.5"], ["below 0", "-1"]] as const) {
    test(`${label} shows the same message`, async ({ page }) => {
      const fixture = await createFixture(page);
      await prepare(page, fixture, null);
      await openAssignmentPage(page, fixture);
      const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

      await gradeField(dialog).fill(value);
      await saveButton(dialog).click();

      await expect(dialog.getByText(GRADE_MESSAGE)).toBeVisible(SAVED);
      expect((await partOf(page, fixture, fixture.students[0])).grade).toBeNull();
    });
  }

  test("the message goes away on the next try, and a valid grade is saved", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await gradeField(dialog).fill("150");
    await saveButton(dialog).click();
    await expect(dialog.getByText(GRADE_MESSAGE)).toBeVisible(SAVED);

    await gradeField(dialog).fill("90");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect((await partOf(page, fixture, fixture.students[0])).grade).toBe(90);
  });

  test("a text file with a PDF name is refused with the file message, and saves nothing", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await fileInput(dialog).setInputFiles({ name: "מזויף.pdf", mimeType: "application/pdf", buffer: Buffer.from("just some text") });
    await saveButton(dialog).click();

    await expect(dialog.getByText(ERROR_MESSAGES.unsupportedFile)).toBeVisible(SAVED);
    await expect(dialog).toBeVisible();
    await expect(fileInput(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "TODO", file: null });
  });

  test("a file over 4 MB is refused with the size message, and its grade is not sent", async ({ page }) => {
    const fixture = await createFixture(page);
    const sent = trackSaves(page);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);

    await fileInput(dialog).setInputFiles(PDF("ענק", 4 * 1024 * 1024));
    await gradeField(dialog).fill("90");
    await saveButton(dialog).click();

    await expect(dialog.getByText(ERROR_MESSAGES.fileTooLarge)).toBeVisible(SAVED);
    expect(sent).toEqual(["PUT file"]);
    expect(await partOf(page, fixture, fixture.students[0])).toMatchObject({ status: "TODO", grade: null, file: null });
  });

  test("a refused file does not change a file that was saved", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const [student] = fixture.students;
    const before = await storedBytes(page, fixture, student);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await fileInput(dialog).setInputFiles({ name: "מזויף.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") });
    await saveButton(dialog).click();

    await expect(dialog.getByText(ERROR_MESSAGES.unsupportedFile)).toBeVisible(SAVED);
    expect((await storedBytes(page, fixture, student)).equals(before)).toBe(true);
  });
});

test.describe("student modal on the assignment page: while saving and errors from the server", () => {
  test("while saving, the save button is disabled and says so", async ({ page }) => {
    const fixture = await createFixture(page);
    await routePart(page, "file", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await fileInput(dialog).setInputFiles(PDF("איטי"));

    await saveButton(dialog).click();

    await expect(dialog.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(dialog).toBeHidden(SAVED);
  });

  test("the form is not sent twice by a second click while saving", async ({ page }) => {
    const fixture = await createFixture(page);
    let puts = 0;
    await routePart(page, "file", async (route) => {
      puts += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await fileInput(dialog).setInputFiles(PDF("פעמיים"));

    await saveButton(dialog).click();
    await dialog.getByRole("button", { name: "שומר..." }).click({ force: true, timeout: 1000 }).catch(() => {});

    await expect(dialog).toBeHidden(SAVED);
    expect(puts).toBe(1);
  });

  test("when the assignment was deleted meanwhile, shows the server's message and keeps the modal", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await gradeField(dialog).fill("90");
    expect((await page.request.delete(`/api/assignments/${fixture.assignment.id}`)).status()).toBe(200);

    await saveButton(dialog).click();

    await expect(alertIn(dialog)).toHaveText(ERROR_MESSAGES.assignmentNotFound, SAVED);
    await expect(dialog).toBeVisible();
  });

  test("shows the generic message for a server error", async ({ page }) => {
    const fixture = await createFixture(page);
    await routePart(page, "file", fulfillJson(500, { error: ERROR_MESSAGES.internal }));
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await fileInput(dialog).setInputFiles(PDF("שגיאה"));

    await saveButton(dialog).click();

    await expect(alertIn(dialog)).toHaveText(ERROR_MESSAGES.internal);
    await expect(saveButton(dialog)).toBeEnabled();
  });

  test("shows the server's message when a grade is sent for a student with no file", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    await routePart(page, "grade", fulfillJson(409, { error: ERROR_MESSAGES.gradeNeedsFile }));
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await gradeField(dialog).fill("90");

    await saveButton(dialog).click();

    await expect(alertIn(dialog)).toHaveText(ERROR_MESSAGES.gradeNeedsFile);
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    let failNext = true;
    await routePart(page, "file", (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    await fileInput(dialog).setInputFiles(PDF("חיבור"));

    await saveButton(dialog).click();
    await expect(alertIn(dialog)).toHaveText(ERROR_MESSAGES.network);
    await expect(saveButton(dialog)).toBeEnabled();

    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect((await partOf(page, fixture, student)).status).toBe("SUBMITTED");
  });
});

test.describe("student modal on the student page", () => {
  test("a file and a grade are saved, and the row shows the date and the grade", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openStudentPage(page, student);
    const dialog = await openFromStudentPage(page, fixture.assignment);

    await fileInput(dialog).setInputFiles(PDF("מדף-התלמיד"));
    await gradeField(dialog).fill("84");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    const cells = studentRow(page, fixture.assignment).locator("td");
    await expect(cells.nth(1)).toHaveText(formatDate(israelToday()), SAVED);
    await expect(cells.nth(2)).toHaveText("84", SAVED);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 84 });
  });

  test("a grade for a student who submitted", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const [student] = fixture.students;
    await openStudentPage(page, student);
    const dialog = await openFromStudentPage(page, fixture.assignment);

    await gradeField(dialog).fill("66");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    await expect(studentRow(page, fixture.assignment).locator("td").nth(2)).toHaveText("66", SAVED);
  });

  test("clearing the grade shows a dash again", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, 90);
    const [student] = fixture.students;
    await openStudentPage(page, student);
    const dialog = await openFromStudentPage(page, fixture.assignment);

    await gradeField(dialog).fill("");
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    await expect(studentRow(page, fixture.assignment).locator("td").nth(2)).toHaveText("-", SAVED);
    expect((await partOf(page, fixture, student)).status).toBe("SUBMITTED");
  });

  test("a grade out of range shows the server's message, and the modal stays", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    await openStudentPage(page, fixture.students[0]);
    const dialog = await openFromStudentPage(page, fixture.assignment);

    await gradeField(dialog).fill("101");
    await saveButton(dialog).click();

    await expect(dialog.getByText(GRADE_MESSAGE)).toBeVisible(SAVED);
    await expect(dialog).toBeVisible();
  });

  test("only that student's part is saved: the other student of the assignment is not touched", async ({ page }) => {
    const fixture = await createFixture(page);
    const [first, second] = fixture.students;
    await openStudentPage(page, second);
    const dialog = await openFromStudentPage(page, fixture.assignment);

    await fileInput(dialog).setInputFiles(PDF("לשני"));
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    expect(await partOf(page, fixture, second)).toMatchObject({ status: "SUBMITTED" });
    expect(await partOf(page, fixture, first)).toMatchObject({ status: "TODO", file: null });
  });

  test("the saved values show when the modal is opened again, also after a reload", async ({ page }) => {
    const fixture = await createFixture(page);
    await prepare(page, fixture, null);
    const [student] = fixture.students;
    await openStudentPage(page, student);
    const first = await openFromStudentPage(page, fixture.assignment);
    await gradeField(first).fill("72");
    await saveButton(first).click();
    await expect(first).toBeHidden(SAVED);

    const reopened = await openFromStudentPage(page, fixture.assignment);
    await expect(gradeField(reopened)).toHaveValue("72");
    await expect(reopened.locator("dd").nth(0)).toHaveText("נבדקה");
    await page.reload();

    const afterReload = await openFromStudentPage(page, fixture.assignment);
    await expect(gradeField(afterReload)).toHaveValue("72");
  });
});

test.describe("student modal: the pages show the change when they are opened with a link", () => {
  test("after a save on the assignment page, the list shows the new count of submitted students", async ({ page }) => {
    const fixture = await createFixture(page);
    await gotoHydrated(page, LIST_URL);
    const listRow = (): Locator => page.locator("tbody tr:visible").filter({ hasText: fixture.assignment.title });
    await expect(listRow().locator("td").nth(3)).toHaveText("0 מתוך 2");
    await listRow().getByRole("link", { name: `פרטים עבור ${fixture.assignment.title}` }).click();
    await expect(page).toHaveURL(`/dashboard/assignments/${fixture.assignment.id}`);
    const dialog = await openFromAssignmentPage(page, fixture, fixture.students[0]);
    await fileInput(dialog).setInputFiles(PDF("לרשימה"));
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    await page.getByRole("link", { name: "חזרה לרשימת המטלות" }).click();

    await expect(page).toHaveURL(LIST_URL);
    await expect(listRow().locator("td").nth(3)).toHaveText("1 מתוך 2", SAVED);
  });

  test("after a save on the student page, the assignment page shows the new status", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    await expectAssignmentRow(page, student, "לביצוע", "-", "-");
    await assignmentRow(page, student).getByRole("link", { name: student.name }).click();
    await expect(page).toHaveURL(`/dashboard/students/${student.id}`);
    const dialog = await openFromStudentPage(page, fixture.assignment);
    await fileInput(dialog).setInputFiles(PDF("לדף"));
    await gradeField(dialog).fill("93");
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    await page.goBack();

    await expect(page).toHaveURL(`/dashboard/assignments/${fixture.assignment.id}`);
    await expectAssignmentRow(page, student, "נבדקה", formatDate(israelToday()), "93");
  });
});

test.describe("student modal: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("a file and a grade can be saved", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);

    await fileInput(dialog).setInputFiles(PDF("צר"));
    await gradeField(dialog).scrollIntoViewIfNeeded();
    await gradeField(dialog).fill("70");
    await saveButton(dialog).scrollIntoViewIfNeeded();
    await saveButton(dialog).click();

    await expect(dialog).toBeHidden(SAVED);
    expect(await partOf(page, fixture, student)).toMatchObject({ status: "CHECKED", grade: 70 });
  });
});

test.describe("student modal: what the database keeps", () => {
  test("the saved part follows the rules of the table: a grade always has a file", async ({ page }) => {
    const fixture = await createFixture(page);
    const [student] = fixture.students;
    await openAssignmentPage(page, fixture);
    const dialog = await openFromAssignmentPage(page, fixture, student);
    await fileInput(dialog).setInputFiles(PDF("חוקי"));
    await gradeField(dialog).fill("55");
    await saveButton(dialog).click();
    await expect(dialog).toBeHidden(SAVED);

    const row = await withTestDb(async (client) => {
      const result = await client.query(
        `select s.status, s.grade, s."submittedAt" is not null as "hasDate", f.id is not null as "hasFile"
         from "AssignmentStudent" s left join "SubmissionFile" f on f."assignmentStudentId" = s.id
         where s."assignmentId" = $1::uuid and s."studentId" = $2::uuid`,
        [fixture.assignment.id, student.id],
      );
      return result.rows[0];
    });

    expect(row).toEqual({ status: "CHECKED", grade: 55, hasDate: true, hasFile: true });
  });
});
