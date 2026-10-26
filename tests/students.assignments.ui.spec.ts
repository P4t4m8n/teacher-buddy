import { expect, test, type Locator, type Page } from "@playwright/test";
import { FILE_ACCEPT, MAX_GRADE, MIN_GRADE } from "../constants/assignment.constant";
import { formatDate } from "../helpers/date";
import { DEMO_SEED, OTHER_SEED } from "../prisma/seed-data";
import type { TStudentAssignment } from "../types/assignment.type";
import { getAssignmentsWithStudents, getStudentList, gotoHydrated, signInAs } from "./helpers";

// The list is what the seed gave to the first student of the demo teacher, so the page is only read and
// the demo teacher is safe. Nothing is saved from the modal yet.
const STUDENT = DEMO_SEED.classes[0].students[0];

// The student's assignments, read from the API of the assignments (a different way than the page reads them).
let ASSIGNMENTS: TStudentAssignment[];
let GRADED: TStudentAssignment;
let LATE: TStudentAssignment;
let UNGRADED: TStudentAssignment;
let TODO: TStudentAssignment;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

const openStudentPage = async (page: Page): Promise<void> => {
  await signInAs(page.request, DEMO_SEED);
  const student = (await getStudentList(page.request)).find(({ name }) => name === STUDENT.name);
  expect(student).toBeDefined();

  ASSIGNMENTS = (await getAssignmentsWithStudents(page.request)).flatMap((assignment) => {
    const part = assignment.students.find(({ studentId }) => studentId === student!.id);
    if (!part) return [];
    const { id, title, dueDate, description } = assignment;
    return [{ id, title, dueDate, description, status: part.status, submittedAt: part.submittedAt, grade: part.grade, file: part.file }];
  });
  const byTitle = (title: string): TStudentAssignment => ASSIGNMENTS.find((assignment) => assignment.title === title)!;
  GRADED = byTitle("עבודה על המהפכה התעשייתית");
  LATE = byTitle("חיבור: המסע שלי");
  UNGRADED = byTitle("סיכום הספר");
  TODO = byTitle("תרגילי חשבון - פרק 4");

  await gotoHydrated(page, `/dashboard/students/${student!.id}`);
};

const row = (page: Page, assignment: TStudentAssignment): Locator =>
  page.locator("tbody tr").filter({ hasText: assignment.title });

const modal = (page: Page, assignment: TStudentAssignment): Locator =>
  page.getByRole("dialog", { name: assignment.title });

const open = async (page: Page, assignment: TStudentAssignment): Promise<Locator> => {
  await row(page, assignment).locator("td").nth(2).click();
  const dialog: Locator = modal(page, assignment);
  await expect(dialog).toBeVisible();
  return dialog;
};

const fileInput = (dialog: Locator): Locator => dialog.locator('input[type="file"]');

test.describe("student assignments: the list", () => {
  test.beforeEach(async ({ page }) => {
    await openStudentPage(page);
  });

  test("has a heading, a link to add an assignment, and the column headers", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "מטלות", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "מטלה חדשה" })).toHaveAttribute(
      "href",
      "/dashboard/assignments/new",
    );
    for (const header of ["שם המטלה", "הוגשה בתאריך", "ציון"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  test("shows one row per assignment, with the name, the submitted date and the grade", async ({ page }) => {
    await expect(page.locator("tbody tr")).toHaveCount(ASSIGNMENTS.length);

    for (const assignment of ASSIGNMENTS) {
      const cells = row(page, assignment).locator("td");
      await expect(cells.nth(0)).toHaveText(assignment.title);
      await expect(cells.nth(1)).toHaveText(
        assignment.submittedAt ? formatDate(assignment.submittedAt) : "לביצוע",
      );
      await expect(cells.nth(2)).toHaveText(assignment.grade === null ? "-" : String(assignment.grade));
    }
  });

  test("an assignment that was not submitted shows its status instead of a date", async ({ page }) => {
    await expect(row(page, TODO).locator("td").nth(1)).toHaveText("לביצוע");
  });

  test("an assignment that was submitted but not graded has no grade yet", async ({ page }) => {
    await expect(row(page, UNGRADED).locator("td").nth(1)).toHaveText(formatDate(UNGRADED.submittedAt!));
    await expect(row(page, UNGRADED).locator("td").nth(2)).toHaveText("-");
  });

  test("rows can be clicked anywhere, so they look clickable", async ({ page }) => {
    await expect(row(page, GRADED)).toHaveCSS("cursor", "pointer");
  });
});

test.describe("student assignments: the modal", () => {
  test.beforeEach(async ({ page }) => {
    await openStudentPage(page);
  });

  test("a click anywhere on the row opens it, named after the assignment, and the page stays", async ({ page }) => {
    const dialog = await open(page, GRADED);

    await expect(dialog.getByRole("heading", { name: GRADED.title, level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: STUDENT.name, level: 1 })).toBeAttached();
    await expect(page.locator("tbody tr")).toHaveCount(ASSIGNMENTS.length);
  });

  test("shows the status and the dates of a graded assignment, and its grade in the grade field", async ({ page }) => {
    const dialog = await open(page, GRADED);

    const values = dialog.locator("dd");
    await expect(values).toHaveCount(3);
    await expect(values.nth(0)).toHaveText("נבדקה");
    await expect(values.nth(1)).toHaveText(formatDate(GRADED.dueDate));
    await expect(values.nth(2)).toHaveText(formatDate(GRADED.submittedAt!));
    await expect(dialog.getByLabel("ציון")).toHaveValue(String(GRADED.grade));
  });

  test("says when it was not submitted, and leaves the grade empty when it was not graded yet", async ({ page }) => {
    const ungraded = await open(page, UNGRADED);
    await expect(ungraded.locator("dd").nth(0)).toHaveText("הוגשה");
    await expect(ungraded.getByLabel("ציון")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(ungraded).toBeHidden();

    const todo = await open(page, TODO);
    await expect(todo.locator("dd").nth(0)).toHaveText("לביצוע");
    await expect(todo.locator("dd").nth(2)).toHaveText("טרם הוגשה");
    await expect(todo.getByLabel("ציון")).toHaveValue("");
  });

  test("shows the description with its formatting, as formatted text and not as markup", async ({ page }) => {
    const dialog = await open(page, GRADED);

    await expect(dialog.getByRole("heading", { name: "תיאור המטלה" })).toBeVisible();
    const description = dialog.locator(".rich-text");
    await expect(description.locator("h2")).toHaveText("הנחיות");
    await expect(description.locator("strong")).toHaveText("עבודה");
    await expect(description.locator("em")).toHaveText("המהפכה התעשייתית");
    await expect(description.locator("ul > li")).toHaveCount(2);
    await expect(description.locator("ul")).toHaveCSS("list-style-type", "disc");
    await expect(description).not.toContainText("<strong>");
  });

  test("a numbered description looks numbered", async ({ page }) => {
    const dialog = await open(page, TODO);

    await expect(dialog.locator(".rich-text ol")).toHaveCSS("list-style-type", "decimal");
    await expect(dialog.locator(".rich-text ol > li")).toHaveCount(2);
  });

  test("has a link to edit the assignment, which opens the edit page", async ({ page }) => {
    const dialog = await open(page, GRADED);
    const link = dialog.getByRole("link", { name: "עריכת המטלה" });

    await expect(link).toHaveAttribute("href", `/dashboard/assignments/${GRADED.id}/edit`);
    await link.click();

    await expect(page).toHaveURL(`/dashboard/assignments/${GRADED.id}/edit`);
    await expect(page.getByRole("heading", { name: "עריכת מטלה" })).toBeVisible();
  });

  test("the close button closes it", async ({ page }) => {
    const dialog = await open(page, GRADED);

    await dialog.getByRole("button", { name: "סגירה" }).click();

    await expect(dialog).toBeHidden();
  });

  test("the keyboard opens it, Escape closes it, and the focus returns to the row", async ({ page }) => {
    const trigger = row(page, GRADED).getByRole("button", { name: GRADED.title });
    await trigger.focus();

    await page.keyboard.press("Enter");
    await expect(modal(page, GRADED)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal(page, GRADED)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("each row opens its own assignment", async ({ page }) => {
    const first = await open(page, GRADED);
    await expect(first.getByLabel("ציון")).toHaveValue(String(GRADED.grade));
    await first.getByRole("button", { name: "סגירה" }).click();

    const second = await open(page, LATE);

    await expect(second.getByLabel("ציון")).toHaveValue(String(LATE.grade));
    await expect(second).not.toContainText(GRADED.title);
  });

  test("the page behind it cannot scroll while it is open", async ({ page }) => {
    await open(page, GRADED);

    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
});

test.describe("student assignments: the file", () => {
  test.beforeEach(async ({ page }) => {
    await openStudentPage(page);
  });

  test("an uploaded PDF is shown in a frame from the file endpoint, with a button to replace it", async ({ page }) => {
    const dialog = await open(page, GRADED);

    expect(GRADED.file).toMatchObject({ name: "עבודה.pdf", kind: "pdf" });
    const frame = dialog.locator(`iframe[title="${GRADED.file!.name}"]`);
    await expect(frame).toHaveAttribute("src", GRADED.file!.url);
    await expect(dialog.getByRole("img")).toHaveCount(0);
    await expect(dialog.getByLabel("החלפת קובץ")).toBeVisible();
  });

  test("the file that the frame shows is the student's own file, and is a PDF", async ({ page }) => {
    expect(GRADED.file!.url).toMatch(/^\/api\/assignments\/[0-9a-f-]{36}\/students\/[0-9a-f-]{36}\/file$/);

    const response = await page.request.get(GRADED.file!.url);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("with no file it says so, and offers an upload", async ({ page }) => {
    const dialog = await open(page, TODO);

    await expect(dialog.getByText("עדיין לא הועלה קובץ")).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveCount(0);
    await expect(dialog.getByLabel("העלאת קובץ")).toBeVisible();
  });

  test("the file picker offers PDFs and images only", async ({ page }) => {
    const dialog = await open(page, TODO);

    await expect(fileInput(dialog)).toHaveAttribute("accept", FILE_ACCEPT);
    expect(FILE_ACCEPT).toContain(".pdf");
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(FILE_ACCEPT).toContain(type);
  });

  test("a picked image is shown at once, in place of the old one", async ({ page }) => {
    const dialog = await open(page, GRADED);

    await fileInput(dialog).setInputFiles({ name: "מטלה-חדשה.png", mimeType: "image/png", buffer: PNG });

    const image = dialog.getByRole("img", { name: "מטלה-חדשה.png" });
    await expect(image).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
    await expect(dialog.locator(`iframe[title="${GRADED.file!.name}"]`)).toHaveCount(0);
  });

  test("a picked image is shown when there was no file before, and the label changes", async ({ page }) => {
    const dialog = await open(page, TODO);

    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });

    await expect(dialog.getByRole("img", { name: "scan.png" })).toBeVisible();
    await expect(dialog.getByText("עדיין לא הועלה קובץ")).toHaveCount(0);
    await expect(dialog.getByLabel("החלפת קובץ")).toBeVisible();
  });

  test("a picked PDF is shown in a frame, titled with its name", async ({ page }) => {
    const dialog = await open(page, TODO);

    await fileInput(dialog).setInputFiles({ name: "עבודה.pdf", mimeType: "application/pdf", buffer: PDF });

    const frame = dialog.locator('iframe[title="עבודה.pdf"]');
    await expect(frame).toHaveAttribute("src", /^blob:/);
    await expect(dialog.getByRole("img")).toHaveCount(0);
  });

  test("another kind of file is only shown by its name", async ({ page }) => {
    const dialog = await open(page, TODO);

    await fileInput(dialog).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });

    await expect(dialog.getByText("notes.txt")).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await expect(dialog.getByRole("img")).toHaveCount(0);
  });

  test("picking another file replaces the first, and clearing it goes back to the saved one", async ({ page }) => {
    const dialog = await open(page, GRADED);
    await fileInput(dialog).setInputFiles({ name: "one.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByRole("img", { name: "one.png" })).toBeVisible();

    await fileInput(dialog).setInputFiles({ name: "two.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(dialog.locator('iframe[title="two.pdf"]')).toBeVisible();
    await expect(dialog.getByRole("img", { name: "one.png" })).toHaveCount(0);

    await fileInput(dialog).setInputFiles([]);
    await expect(dialog.locator(`iframe[title="${GRADED.file!.name}"]`)).toBeVisible();
  });

  test("closing and reopening forgets the picked file", async ({ page }) => {
    const dialog = await open(page, TODO);
    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByRole("img", { name: "scan.png" })).toBeVisible();
    await page.keyboard.press("Escape");

    const reopened = await open(page, TODO);

    await expect(reopened.getByText("עדיין לא הועלה קובץ")).toBeVisible();
    await expect(reopened.getByRole("img")).toHaveCount(0);
  });

  test("a file picked in one assignment does not show in another", async ({ page }) => {
    const first = await open(page, TODO);
    await fileInput(first).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await page.keyboard.press("Escape");

    const second = await open(page, GRADED);

    await expect(second.getByRole("img", { name: "scan.png" })).toHaveCount(0);
    await expect(second.locator(`iframe[title="${GRADED.file!.name}"]`)).toBeVisible();
  });

  test("picking a file saves nothing: after a reload the list is the same", async ({ page }) => {
    const dialog = await open(page, TODO);
    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });

    await page.reload();

    const reopened = await open(page, TODO);
    await expect(reopened.getByText("עדיין לא הועלה קובץ")).toBeVisible();
  });
});

test.describe("student assignments: the grade", () => {
  test.beforeEach(async ({ page }) => {
    await openStudentPage(page);
  });

  test("is a number field from 0 to 100, in whole numbers, with a hint", async ({ page }) => {
    const grade = (await open(page, TODO)).getByLabel("ציון");

    await expect(grade).toHaveAttribute("type", "number");
    await expect(grade).toHaveAttribute("min", String(MIN_GRADE));
    await expect(grade).toHaveAttribute("max", String(MAX_GRADE));
    await expect(grade).toHaveAttribute("step", "1");
    await expect(grade).toHaveAttribute("inputmode", "numeric");
    await expect(grade).toHaveAttribute("placeholder", `${MIN_GRADE} - ${MAX_GRADE}`);
  });

  test("a grade can be typed, changed and cleared", async ({ page }) => {
    const grade = (await open(page, UNGRADED)).getByLabel("ציון");

    await grade.fill("77");
    await expect(grade).toHaveValue("77");
    await grade.fill("100");
    await expect(grade).toHaveValue("100");
    await grade.fill("");
    await expect(grade).toHaveValue("");
  });

  test("an existing grade can be updated", async ({ page }) => {
    const grade = (await open(page, GRADED)).getByLabel("ציון");
    await expect(grade).toHaveValue(String(GRADED.grade));

    await grade.fill("95");

    await expect(grade).toHaveValue("95");
  });

  test("an assignment that was uploaded can be graded: the grade field is open, with no warning", async ({ page }) => {
    for (const assignment of [GRADED, UNGRADED]) {
      const dialog = await open(page, assignment);

      await expect(dialog.getByLabel("ציון")).toBeEnabled();
      await expect(dialog.getByText("ניתן להזין ציון רק אחרי העלאת המטלה")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("an assignment that was not uploaded cannot be graded: the grade field is closed, and says why", async ({
    page,
  }) => {
    const dialog = await open(page, TODO);
    const grade = dialog.getByLabel("ציון");

    await expect(grade).toBeDisabled();
    await expect(grade).toHaveAccessibleDescription("ניתן להזין ציון רק אחרי העלאת המטלה");
    await expect(dialog.getByText("ניתן להזין ציון רק אחרי העלאת המטלה")).toBeVisible();
    await expect(grade).toHaveCSS("cursor", "not-allowed");
  });

  test("choosing a file opens the grade field, and removing the file closes it again", async ({ page }) => {
    const dialog = await open(page, TODO);
    await expect(dialog.getByLabel("ציון")).toBeDisabled();

    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByLabel("ציון")).toBeEnabled();
    await expect(dialog.getByText("ניתן להזין ציון רק אחרי העלאת המטלה")).toHaveCount(0);
    await dialog.getByLabel("ציון").fill("80");
    await expect(dialog.getByLabel("ציון")).toHaveValue("80");

    await fileInput(dialog).setInputFiles([]);
    await expect(dialog.getByLabel("ציון")).toBeDisabled();
    await expect(dialog.getByText("ניתן להזין ציון רק אחרי העלאת המטלה")).toBeVisible();
  });

  test("a disabled grade is not sent with the form", async ({ page }) => {
    const dialog = await open(page, TODO);
    const sent: string[] = await dialog.locator("form").evaluate((form: HTMLFormElement) => [...new FormData(form).keys()]);

    expect(sent).not.toContain("grade");

    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    const sentWithFile: string[] = await dialog.locator("form").evaluate((form: HTMLFormElement) => [...new FormData(form).keys()]);
    expect(sentWithFile).toContain("grade");
    expect(sentWithFile).toContain("file");
  });

  test("the keyboard skips a closed grade field, and reaches an open one after the file", async ({ page }) => {
    const closed = await open(page, TODO);
    await fileInput(closed).focus();
    await page.keyboard.press("Tab");
    await expect(closed.getByRole("link", { name: "עריכת המטלה" })).toBeFocused();
    await page.keyboard.press("Escape");

    const open_ = await open(page, UNGRADED);
    await fileInput(open_).focus();
    await page.keyboard.press("Tab");
    await expect(open_.getByLabel("ציון")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(open_.getByRole("link", { name: "עריכת המטלה" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(open_.getByRole("button", { name: "שמירה" })).toBeFocused();
  });

  test("the file and the grade are in one form, with a save button", async ({ page }) => {
    const dialog = await open(page, GRADED);
    const form = dialog.locator("form");

    await expect(form.getByLabel("ציון")).toBeVisible();
    await expect(form.locator('input[type="file"]')).toBeVisible();
    await expect(form.getByRole("button", { name: "שמירה", exact: true })).toHaveAttribute("type", "submit");
    await expect(form).toHaveAttribute("novalidate", "");
  });

  test("saving does nothing yet: it sends no request, and the modal and the typed grade stay", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
    });
    const dialog = await open(page, UNGRADED);
    await dialog.getByLabel("ציון").fill("88");

    await dialog.getByRole("button", { name: "שמירה", exact: true }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("ציון")).toHaveValue("88");
    await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]{36}$/);
    expect(requests).toEqual([]);
  });

  test("a value out of range does not raise the browser's own message: the server will answer", async ({ page }) => {
    const dialog = await open(page, UNGRADED);
    await dialog.getByLabel("ציון").fill("150");

    await dialog.getByRole("button", { name: "שמירה", exact: true }).click();

    await expect(dialog.getByLabel("ציון")).toHaveValue("150");
    await expect(dialog.getByLabel("ציון")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("a typed grade is forgotten when the modal closes, and another assignment has its own", async ({ page }) => {
    const first = await open(page, UNGRADED);
    await first.getByLabel("ציון").fill("55");
    await page.keyboard.press("Escape");

    const second = await open(page, GRADED);
    await expect(second.getByLabel("ציון")).toHaveValue(String(GRADED.grade));
    await page.keyboard.press("Escape");

    const again = await open(page, UNGRADED);
    await expect(again.getByLabel("ציון")).toHaveValue("");
  });

  test("the grade shows in the list once it exists, and an empty grade shows a dash", async ({ page }) => {
    await expect(row(page, GRADED).locator("td").nth(2)).toHaveText(String(GRADED.grade));
    await expect(row(page, UNGRADED).locator("td").nth(2)).toHaveText("-");
  });
});

test.describe("student assignments: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("the list and the modal fit the screen, and the modal scrolls to the edit link", async ({ page }) => {
    await openStudentPage(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    const dialog = await open(page, GRADED);

    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(780);
    const link = dialog.getByRole("link", { name: "עריכת המטלה" });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport();
  });

  test("the grade and the save button can be reached and used", async ({ page }) => {
    await openStudentPage(page);
    const dialog = await open(page, UNGRADED);

    const grade = dialog.getByLabel("ציון");
    await grade.scrollIntoViewIfNeeded();
    await grade.fill("90");
    const save = dialog.getByRole("button", { name: "שמירה", exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    const box = await save.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});

test.describe("student assignments: other students", () => {
  const openStudent = async (page: Page, name: string): Promise<void> => {
    await signInAs(page.request, DEMO_SEED);
    const student = (await getStudentList(page.request)).find((candidate) => candidate.name === name)!;
    await gotoHydrated(page, `/dashboard/students/${student.id}`);
  };

  test("a student only shows their own assignments, with their own grade", async ({ page }) => {
    await openStudent(page, "איתי ברק");

    await expect(page.locator("tbody tr")).toHaveCount(2);
    const revolution = page.locator("tbody tr").filter({ hasText: "עבודה על המהפכה התעשייתית" });
    await expect(revolution.locator("td").nth(2)).toHaveText("88");
    await expect(page.locator("tbody tr").filter({ hasText: "תרגילי חשבון - פרק 4" }).locator("td").nth(1)).toHaveText("לביצוע");
    await expect(page.getByText("חיבור: המסע שלי")).toHaveCount(0);
    await expect(page.getByText("סיכום הספר")).toHaveCount(0);
  });

  test("a student who was given no assignment shows the empty message, with the add link", async ({ page }) => {
    await openStudent(page, "שיר דהן");

    await expect(page.getByText("עדיין אין מטלות לתלמיד הזה")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "מטלה חדשה" })).toBeVisible();
  });

  test("a student of another teacher shows the not-found page, with nothing of the assignments", async ({ page }) => {
    await signInAs(page.request, OTHER_SEED);
    const theirs = (await getStudentList(page.request))[0];
    await signInAs(page.request, DEMO_SEED);

    await page.goto(`/dashboard/students/${theirs.id}`);

    await expect(page.getByRole("heading", { name: "התלמיד לא נמצא" })).toBeVisible();
    await expect(page.getByText("קריאה: פרק ראשון")).toHaveCount(0);
  });
});
