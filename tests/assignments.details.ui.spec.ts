import { expect, test, type Locator, type Page } from "@playwright/test";
import { ASSIGNMENT_STATUS_LABELS } from "../constants/assignment.constant";
import { countSubmitted } from "../helpers/assignment";
import { formatDate } from "../helpers/date";
import { DEMO_SEED, OTHER_SEED } from "../prisma/seed-data";
import type { TAssignmentStudent, TTeacherAssignment } from "../types/assignment.type";
import { findByTitle, getAssignmentsWithStudents, gotoHydrated, signInAs } from "./helpers";

// The pages show what the seed gave to the demo teacher, so they are only read and the demo teacher is safe.
// Nothing is saved from the modal yet.
const UNKNOWN_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

const pageOf = (assignment: TTeacherAssignment): string => `/dashboard/assignments/${assignment.id}`;

const studentRow = (page: Page, student: TAssignmentStudent): Locator =>
  page.locator("tbody tr").filter({ hasText: student.name });

const fileInput = (dialog: Locator): Locator => dialog.locator('input[type="file"]');

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let first: TTeacherAssignment;
let third: TTeacherAssignment;
let last: TTeacherAssignment;

// A student of the assignment who submitted and was checked: with a file and a grade.
const checkedStudent = (assignment: TTeacherAssignment): TAssignmentStudent =>
  assignment.students.find(({ status }) => status === "CHECKED")!;

test.beforeEach(async ({ page }) => {
  await signInAs(page.request, DEMO_SEED);
  const assignments: TTeacherAssignment[] = await getAssignmentsWithStudents(page.request);
  first = findByTitle(assignments, "עבודה על המהפכה התעשייתית");
  third = findByTitle(assignments, "סיכום הספר");
  last = findByTitle(assignments, "תרגילי חשבון - פרק 4");
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
      await expect(cells.nth(2)).toHaveText(ASSIGNMENT_STATUS_LABELS[student.status]);
      await expect(cells.nth(3)).toHaveText(student.submittedAt ? formatDate(student.submittedAt) : "-");
      await expect(cells.nth(4)).toHaveText(student.grade === null ? "-" : String(student.grade));
    }
  });

  test("shows the status of every student: checked ones and one who did not submit", async ({ page }) => {
    const statuses = new Set(first.students.map(({ status }) => status));

    expect(statuses).toEqual(new Set(["CHECKED", "TODO"]));
    await expect(page.getByText("נבדקה", { exact: true })).toHaveCount(2);
    await expect(page.getByText("לביצוע", { exact: true })).toHaveCount(1);
    await expect(page.getByText("הוגשה", { exact: true })).toHaveCount(0);
  });

  test("a student who submitted and was not checked yet shows the submitted status and no grade", async ({
    page,
  }) => {
    await gotoHydrated(page, pageOf(third));
    const waiting = third.students.find(({ status }) => status === "SUBMITTED")!;

    const cells = studentRow(page, waiting).locator("td");
    await expect(cells.nth(2)).toHaveText("הוגשה");
    await expect(cells.nth(3)).toHaveText(formatDate(waiting.submittedAt!));
    await expect(cells.nth(4)).toHaveText("-");
    await expect(page.getByRole("region", { name: "פרטי המטלה" }).locator("dd").nth(2)).toHaveText(
      `${countSubmitted(third)} מתוך ${third.students.length}`,
    );
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
    const student = checkedStudent(first);

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();

    const dialog = page.getByRole("dialog", { name: `${student.name} - ${first.title}` });
    await expect(dialog).toBeVisible();
    const values = dialog.locator("dd");
    await expect(values).toHaveCount(3);
    await expect(values.nth(0)).toHaveText(ASSIGNMENT_STATUS_LABELS[student.status]);
    await expect(values.nth(1)).toHaveText(formatDate(first.dueDate));
    await expect(values.nth(2)).toHaveText(formatDate(student.submittedAt!));
    await expect(dialog.getByLabel("ציון")).toHaveValue(String(student.grade));
    await expect(dialog.locator(".rich-text h2")).toHaveText("הנחיות");
  });

  test("a submitted student's file is shown in a frame, from the file endpoint", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const student = checkedStudent(first);

    await studentRow(page, student).getByRole("button", { name: `פרטים עבור ${student.name}` }).click();

    const dialog = page.getByRole("dialog");
    expect(student.file).toMatchObject({ name: "עבודה.pdf", kind: "pdf" });
    expect(student.file!.url).toBe(`/api/assignments/${first.id}/students/${student.studentId}/file`);
    await expect(dialog.locator("iframe")).toHaveAttribute("title", student.file!.name);
    await expect(dialog.locator("iframe")).toHaveAttribute("src", student.file!.url);
    await expect(dialog.getByLabel("החלפת קובץ")).toBeVisible();
  });

  test("the file that the frame shows can be read by the teacher: it is a PDF", async ({ page }) => {
    const student = checkedStudent(first);

    const response = await page.request.get(student.file!.url);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("a student who did not submit has no file and cannot be graded, until the file is added", async ({ page }) => {
    await gotoHydrated(page, pageOf(first));
    const waiting = first.students.find(({ status }) => status === "TODO")!;

    await studentRow(page, waiting).getByRole("button", { name: `פרטים עבור ${waiting.name}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("dd").nth(2)).toHaveText("טרם הוגשה");
    await expect(dialog.getByText("עדיין לא הועלה קובץ")).toBeVisible();
    await expect(dialog.getByLabel("ציון")).toBeDisabled();
    await expect(dialog.getByText("ניתן להזין ציון רק אחרי העלאת המטלה")).toBeVisible();
    await fileInput(dialog).setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: PNG });
    await expect(dialog.getByRole("img", { name: "scan.png" })).toHaveAttribute("src", /^blob:/);
    await expect(dialog.getByLabel("ציון")).toBeEnabled();
  });

  test("a student who submitted and was not checked can be graded", async ({ page }) => {
    await gotoHydrated(page, pageOf(third));
    const waiting = third.students.find(({ status }) => status === "SUBMITTED")!;

    await studentRow(page, waiting).getByRole("button", { name: `פרטים עבור ${waiting.name}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("dd").nth(0)).toHaveText("הוגשה");
    await expect(dialog.getByLabel("ציון")).toBeEnabled();
    await expect(dialog.getByLabel("ציון")).toHaveValue("");
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
    await expect(page.getByText("נבדקה", { exact: true })).toHaveCount(0);
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

  test("an assignment of another teacher shows the same page, with nothing of it", async ({ page }) => {
    await page.context().clearCookies();
    await signInAs(page.request, OTHER_SEED);
    const [theirs] = await getAssignmentsWithStudents(page.request);
    await signInAs(page.request, DEMO_SEED);

    await page.goto(pageOf(theirs));

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
    await expect(page.getByText(theirs.title)).toHaveCount(0);
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
