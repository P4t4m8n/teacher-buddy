import { expect, test, type Locator, type Page } from "@playwright/test";
import { FILE_ACCEPT, SAMPLE_STUDENT_ASSIGNMENTS } from "../constants/assignment.constant";
import { formatDate } from "../helpers/date";
import { DEMO_SEED } from "../prisma/seed-data";
import type { TStudentAssignment } from "../types/assignment.type";
import { getStudentList, gotoHydrated, signInAs } from "./helpers";

// The list is hardcoded for now (nothing is saved), so the page is only read and the demo teacher is safe.
const STUDENT = DEMO_SEED.classes[0].students[0];
const [GRADED, LATE, UNGRADED, TODO] = SAMPLE_STUDENT_ASSIGNMENTS;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

const openStudentPage = async (page: Page): Promise<void> => {
  await signInAs(page.request, DEMO_SEED);
  const student = (await getStudentList(page.request)).find(({ name }) => name === STUDENT.name);
  expect(student).toBeDefined();
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
    await expect(page.locator("tbody tr")).toHaveCount(SAMPLE_STUDENT_ASSIGNMENTS.length);

    for (const assignment of SAMPLE_STUDENT_ASSIGNMENTS) {
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
    await expect(page.locator("tbody tr")).toHaveCount(SAMPLE_STUDENT_ASSIGNMENTS.length);
  });

  test("shows the status, the dates and the grade of a graded assignment", async ({ page }) => {
    const dialog = await open(page, GRADED);

    const values = dialog.locator("dd");
    await expect(values.nth(0)).toHaveText("הוגשה");
    await expect(values.nth(1)).toHaveText(formatDate(GRADED.dueDate));
    await expect(values.nth(2)).toHaveText(formatDate(GRADED.submittedAt!));
    await expect(values.nth(3)).toHaveText(String(GRADED.grade));
  });

  test("says when it was not graded yet, or not submitted", async ({ page }) => {
    const ungraded = await open(page, UNGRADED);
    await expect(ungraded.locator("dd").nth(3)).toHaveText("טרם נבדקה");
    await page.keyboard.press("Escape");
    await expect(ungraded).toBeHidden();

    const todo = await open(page, TODO);
    await expect(todo.locator("dd").nth(0)).toHaveText("לביצוע");
    await expect(todo.locator("dd").nth(2)).toHaveText("טרם הוגשה");
    await expect(todo.locator("dd").nth(3)).toHaveText("טרם נבדקה");
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
    await expect(first.locator("dd").nth(3)).toHaveText(String(GRADED.grade));
    await first.getByRole("button", { name: "סגירה" }).click();

    const second = await open(page, LATE);

    await expect(second.locator("dd").nth(3)).toHaveText(String(LATE.grade));
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

  test("an uploaded file is shown as an image that loads, with a button to replace it", async ({ page }) => {
    const dialog = await open(page, GRADED);

    const image = dialog.getByRole("img", { name: GRADED.file!.name });
    await expect(image).toHaveAttribute("src", GRADED.file!.url);
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await expect(dialog.getByLabel("החלפת קובץ")).toBeVisible();
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
    await expect(dialog.getByRole("img", { name: GRADED.file!.name })).toHaveCount(0);
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
    await expect(dialog.getByRole("img", { name: GRADED.file!.name })).toBeVisible();
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
    await expect(second.getByRole("img", { name: GRADED.file!.name })).toBeVisible();
  });

  test("picking a file saves nothing: after a reload the list is the same", async ({ page }) => {
    const dialog = await open(page, TODO);
    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });

    await page.reload();

    const reopened = await open(page, TODO);
    await expect(reopened.getByText("עדיין לא הועלה קובץ")).toBeVisible();
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
});
