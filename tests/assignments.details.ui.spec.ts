import { expect, test, type Locator, type Page } from "@playwright/test";
import { getSampleTeacherAssignments } from "../constants/assignment.constant";
import { countSubmitted } from "../helpers/assignment";
import { formatDate } from "../helpers/date";
import { DEMO_SEED } from "../prisma/seed-data";
import type { TAssignmentStudent, TTeacherAssignment } from "../types/assignment.type";
import { getStudentList, gotoHydrated, signInAs } from "./helpers";

// The data is hardcoded for now (nothing is saved), so the page is only read and the demo teacher is safe.
const UNKNOWN_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

const pageOf = (assignment: TTeacherAssignment): string => `/dashboard/assignments/${assignment.id}`;

const studentRow = (page: Page, student: TAssignmentStudent): Locator =>
  page.locator("tbody tr").filter({ hasText: student.name });

const fileInput = (dialog: Locator): Locator => dialog.locator('input[type="file"]');

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let assignments: TTeacherAssignment[];
let first: TTeacherAssignment;
let last: TTeacherAssignment;

test.beforeEach(async ({ page }) => {
  await signInAs(page.request, DEMO_SEED);
  assignments = getSampleTeacherAssignments(await getStudentList(page.request));
  [first] = assignments;
  last = assignments[assignments.length - 1];
});

test.describe("assignment page: the summary", () => {
  test("shows the title, due date, number of students, how many submitted, and the description", async ({
    page,
  }) => {
    await gotoHydrated(page, pageOf(first));

    const summary = page.getByRole("region", { name: "פרטי המטלה" });
    await expect(summary.getByRole("heading", { name: first.title, level: 1 })).toBeVisible();
    const values = summary.locator("dd");
    await expect(values.nth(0)).toHaveText(formatDate(first.dueDate));
    await expect(values.nth(1)).toHaveText(String(first.students.length));
    await expect(values.nth(2)).toHaveText(`${countSubmitted(first)} מתוך ${first.students.length}`);

    const description = summary.locator(".rich-text");
    await expect(description.locator("h2")).toHaveText("הנחיות");
    await expect(description.locator("strong")).toHaveText("עבודה");
    await expect(description.locator("ul > li")).toHaveCount(2);
    await expect(description).not.toContainText("<strong>");
  });

  test("has a link to edit the assignment, which opens the edit page", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));

    await page.getByRole("region", { name: "פרטי המטלה" }).getByRole("link", { name: "עריכת המטלה" }).click();

    await expect(page).toHaveURL(`${pageOf(first)}/edit`);
    await expect(page.getByLabel("שם המטלה")).toHaveValue(first.title);
  });

  test("the back link goes to the assignments list", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));

    await page.getByRole("link", { name: "חזרה לרשימת המטלות" }).click();

    await expect(page).toHaveURL("/dashboard/assignments");
  });

  test("a direct link works, and survives a refresh", async ({ page }) => {
    await page.goto(pageOf(first));
    await page.reload();

    await expect(page.getByRole("heading", { name: first.title, level: 1 })).toBeVisible();
  });
});

test.describe("assignment page: the students", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
  });

  test("lists every student of the assignment, with the class, the status, the date and the grade", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "התלמידים במטלה" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(first.students.length);

    for (const student of first.students) {
      const cells = studentRow(page, student).locator("td");
      await expect(cells.nth(0)).toContainText(student.name);
      await expect(cells.nth(1)).toHaveText(student.className);
      await expect(cells.nth(2)).toHaveText(student.status === "SUBMITTED" ? "הוגשה" : "לביצוע");
      await expect(cells.nth(3)).toHaveText(student.submittedAt ? formatDate(student.submittedAt) : "-");
      await expect(cells.nth(4)).toHaveText(student.grade === null ? "-" : String(student.grade));
    }
  });

  test("shows both a submitted student and one who did not submit", async ({ page }) => {
    const statuses = new Set(first.students.map(({ status }) => status));

    expect(statuses).toEqual(new Set(["SUBMITTED", "TODO"]));
    await expect(page.getByText("הוגשה", { exact: true })).toHaveCount(2);
    await expect(page.getByText("לביצוע", { exact: true })).toHaveCount(1);
  });

  test("the name of a student is a link to the student's page", async ({ page }) => {
    const [student] = first.students;
    const link = studentRow(page, student).getByRole("link", { name: student.name });

    await expect(link).toHaveAttribute("href", `/dashboard/students/${student.studentId}`);
    await link.click();

    await expect(page).toHaveURL(`/dashboard/students/${student.studentId}`);
    await expect(page.getByRole("heading", { name: student.name, level: 1 })).toBeVisible();
  });
});

test.describe("assignment page: a student's details", () => {
  test("the details button opens a modal named after the student and the assignment", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const [student] = first.students;

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();

    const dialog = page.getByRole("dialog", { name: `${student.name} - ${first.title}` });
    await expect(dialog).toBeVisible();
    const values = dialog.locator("dd");
    await expect(values).toHaveCount(3);
    await expect(values.nth(0)).toHaveText("הוגשה");
    await expect(values.nth(1)).toHaveText(formatDate(first.dueDate));
    await expect(values.nth(2)).toHaveText(formatDate(student.submittedAt!));
    await expect(dialog.getByLabel("ציון")).toHaveValue(String(student.grade));
    await expect(dialog.locator(".rich-text h2")).toHaveText("הנחיות");
  });

  test("a submitted student's file is shown", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const [student] = first.students;

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();

    const image = page.getByRole("dialog").getByRole("img", { name: student.file!.name });
    await expect(image).toHaveAttribute("src", student.file!.url);
    await expect(page.getByRole("dialog").getByLabel("החלפת קובץ")).toBeVisible();
  });

  test("a student who did not submit has no file, and the file can be added", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const waiting = first.students.find(({ status }) => status === "TODO")!;

    await studentRow(page, waiting).getByRole("button", { name: `פרטים עבור ${waiting.name}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("dd").nth(2)).toHaveText("טרם הוגשה");
    await expect(dialog.getByText("עדיין לא הועלה קובץ")).toBeVisible();
    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByRole("img", { name: "scan.png" })).toHaveAttribute("src", /^blob:/);
  });

  test("each student's button opens that student's modal, and Escape closes it", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const [one, two] = first.students;
    const trigger = studentRow(page, one).getByRole("button", { name: `פרטים עבור ${one.name}` });

    await trigger.click();
    await expect(page.getByRole("dialog", { name: `${one.name} - ${first.title}` })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();

    await studentRow(page, two).getByRole("button", { name: `פרטים עבור ${two.name}` }).click();
    await expect(page.getByRole("dialog", { name: `${two.name} - ${first.title}` })).toBeVisible();
    await expect(page.getByRole("dialog")).not.toContainText(one.name);
  });

  test("the modal has a link to edit the assignment", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const [student] = first.students;

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();

    await expect(page.getByRole("dialog").getByRole("link", { name: "עריכת המטלה" })).toHaveAttribute(
      "href",
      `${pageOf(first)}/edit`,
    );
  });
});

test.describe("assignment page: other assignments", () => {
  test("an assignment nobody submitted shows only students who have not submitted", async ({ page }) => {
    await gotoHydrated(page, pageOf(last));

    await expect(page.locator("tbody tr")).toHaveCount(last.students.length);
    await expect(page.getByRole("region", { name: "פרטי המטלה" }).locator("dd").nth(2)).toHaveText(
      `0 מתוך ${last.students.length}`,
    );
    await expect(page.getByText("הוגשה", { exact: true })).toHaveCount(0);
  });
});

test.describe("assignment page: not found and access", () => {
  test("an assignment that does not exist shows the not-found page, with a way back", async ({ page }) => {
    await page.goto(`/dashboard/assignments/${UNKNOWN_ID}`);

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
    await page.getByRole("link", { name: "חזרה לרשימת המטלות" }).click();
    await expect(page).toHaveURL("/dashboard/assignments");
  });

  test("an id that is not a uuid shows the same page", async ({ page }) => {
    await page.goto("/dashboard/assignments/not-a-uuid");

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
  });

  test("needs a sign-in", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(pageOf(first));

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("assignment page: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("fits the screen, with the class under the student's name, and the modal opens", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const [student] = first.students;

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole("columnheader", { name: "כיתה" })).toBeHidden();
    await expect(studentRow(page, student).locator("td").first().getByText(student.className)).toBeVisible();

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});
