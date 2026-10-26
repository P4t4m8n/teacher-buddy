import { expect, test, type Locator, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_OTHER_SEED, WRITE_SEED } from "../prisma/seed-data";
import type { TStudent } from "../types/student.type";
import {
  createStudent,
  fillStudentForm,
  getClassList,
  getStudentList,
  gotoHydrated,
  randomDigits,
  signInAs,
  submitStudentForm,
  uniqueName,
  uniquePhone,
} from "./helpers";

// These tests change students, so they only use a write teacher and only change students they created
// themselves (see helpers).
const DASHBOARD_URL = "/dashboard";
const EDIT_URL = /\/dashboard\/students\/[0-9a-f-]{36}\/edit$/;
const CLASS_NAMES: string[] = WRITE_SEED.classes.map(({ name }) => name);
const UNKNOWN_ID = "0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60";

const NAME_TOO_SHORT = "השם חייב להכיל לפחות 2 תווים";
const NAME_BAD_CHARACTERS = "השם יכול להכיל רק אותיות, רווחים, גרש ומקף";
const PHONE_INVALID = "מספר טלפון לא תקין (לדוגמה 050-1234567)";

// Saving goes through the API and then to the dashboard, which can take longer than 5 seconds when
// many tests run at once.
const SAVED = { timeout: 20_000 };

const editUrl = (student: TStudent): string => `/dashboard/students/${student.id}/edit`;
const studentApiUrl = (student: TStudent): string => `**/api/students/${student.id}`;

const save = (page: Page): Promise<void> => submitStudentForm(page, "שמירה");

const studentRow = (page: Page, name: string): Locator => page.locator("tbody tr").filter({ hasText: name });

// A student the test owns, and its edit page opened.
const openEditPage = async (page: Page): Promise<TStudent> => {
  await signInAs(page.request, WRITE_SEED);
  const student: TStudent = await createStudent(page.request);
  await gotoHydrated(page, editUrl(student));
  return student;
};

const fromApi = async (page: Page, student: TStudent): Promise<TStudent | undefined> =>
  (await getStudentList(page.request)).find(({ id }) => id === student.id);

// The student, as the API shows it, must still be exactly what it was.
const expectUnchanged = async (page: Page, student: TStudent): Promise<void> => {
  expect(await fromApi(page, student)).toEqual(student);
};

// Answers only the PUT request of this student, so the page can still load normally.
const routePut = (page: Page, student: TStudent, handler: Parameters<Page["route"]>[1]) =>
  page.route(studentApiUrl(student), (route) =>
    route.request().method() === "PUT" ? handler(route, route.request()) : route.continue(),
  );

test.describe("edit student: getting to the page", () => {
  test("the edit link of a row opens that student's edit page", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);
    const student: TStudent = await createStudent(page.request);
    await gotoHydrated(page, DASHBOARD_URL);

    await page.getByRole("link", { name: `עריכה עבור ${student.name}` }).click();

    await expect(page).toHaveURL(editUrl(student));
    await expect(page.getByRole("heading", { name: "עריכת תלמיד" })).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(student.name);
  });

  test("without a session it goes to the sign-in page", async ({ page }) => {
    await page.goto(`/dashboard/students/${UNKNOWN_ID}/edit`);

    await expect(page).toHaveURL(/\/auth$/);
  });

  test("a student that does not exist shows the not-found page", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);

    await page.goto(`/dashboard/students/${UNKNOWN_ID}/edit`);

    await expect(page.getByRole("heading", { name: ERROR_MESSAGES.studentNotFound })).toBeVisible();
    await expect(page.getByRole("button", { name: "שמירה" })).toHaveCount(0);
  });

  test("an id that is not a uuid shows the same page", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);

    await page.goto("/dashboard/students/not-a-uuid/edit");

    await expect(page.getByRole("heading", { name: ERROR_MESSAGES.studentNotFound })).toBeVisible();
  });

  test("a student of another teacher shows the same page, and nothing of the student", async ({ page }) => {
    await signInAs(page.request, WRITE_OTHER_SEED);
    const otherStudent: TStudent = await createStudent(page.request);
    await signInAs(page.request, WRITE_SEED);

    await page.goto(editUrl(otherStudent));

    await expect(page.getByRole("heading", { name: ERROR_MESSAGES.studentNotFound })).toBeVisible();
    await expect(page.getByText(otherStudent.name)).toHaveCount(0);
    await expect(page.getByLabel("שם התלמיד")).toHaveCount(0);
  });
});

test.describe("edit student: the page", () => {
  test("is filled with the student's current values", async ({ page }) => {
    const student: TStudent = await openEditPage(page);

    await expect(page.getByLabel("שם התלמיד")).toHaveValue(student.name);
    await expect(page.getByLabel("טלפון")).toHaveValue(student.phone);
    await expect(page.getByLabel("כיתה").locator("option:checked")).toHaveText(student.class.name);
    await expect(page.getByLabel("כיתה").locator("option")).toHaveText(["בחרו כיתה", ...CLASS_NAMES]);
  });

  test("has the save button, the cancel link and the back link", async ({ page }) => {
    await openEditPage(page);

    await expect(page.getByRole("button", { name: "שמירה", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ביטול" })).toBeVisible();
    await expect(page.getByRole("link", { name: "חזרה לרשימת התלמידים" })).toBeVisible();
    await expect(page.locator("header")).toContainText(WRITE_SEED.name);
  });

  test("shows the saved values, not what the list showed when it loaded", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);
    const student: TStudent = await createStudent(page.request);
    await gotoHydrated(page, DASHBOARD_URL);
    // The student is changed after the list was loaded, as if from another tab.
    const changed = { name: uniqueName(), phone: uniquePhone(), classId: student.class.id };
    expect((await page.request.put(`/api/students/${student.id}`, { data: changed })).status()).toBe(200);

    await page.goto(editUrl(student));

    await expect(page.getByLabel("שם התלמיד")).toHaveValue(changed.name);
    await expect(page.getByLabel("טלפון")).toHaveValue(changed.phone);
  });

  test("focuses the name field", async ({ page }) => {
    await openEditPage(page);

    await expect(page.getByLabel("שם התלמיד")).toBeFocused();
  });

  test("the cancel link goes back to the list and changes nothing", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await page.getByLabel("שם התלמיד").fill(uniqueName());

    await page.getByRole("link", { name: "ביטול" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
    await expectUnchanged(page, student);
  });

  test("the back link goes back to the list", async ({ page }) => {
    await openEditPage(page);

    await page.getByRole("link", { name: "חזרה לרשימת התלמידים" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
  });
});

test.describe("edit student: validation", () => {
  test("clearing the fields shows the errors, keeps the page, and changes nothing", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await page.getByLabel("שם התלמיד").fill("");
    await page.getByLabel("טלפון").fill("");
    await page.getByLabel("כיתה").selectOption("");

    await save(page);

    await expect(page.getByText(NAME_TOO_SHORT)).toBeVisible();
    await expect(page.getByText(PHONE_INVALID)).toBeVisible();
    await expect(page.getByText("יש לבחור כיתה")).toBeVisible();
    await expect(page).toHaveURL(editUrl(student));
    await expectUnchanged(page, student);
  });

  test("shows the matching message only for the field with a problem, and keeps what was typed", async ({
    page,
  }) => {
    const student: TStudent = await openEditPage(page);
    await page.getByLabel("שם התלמיד").fill("דנה1");

    await save(page);

    await expect(page.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    await expect(page.getByText(PHONE_INVALID)).toHaveCount(0);
    await expect(page.getByLabel("שם התלמיד")).toHaveValue("דנה1");
    await expect(page.getByLabel("טלפון")).toHaveValue(student.phone);
    await expectUnchanged(page, student);
  });

  test("the errors go away after the problems are fixed and the form is saved", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await page.getByLabel("טלפון").fill("123");
    await save(page);
    await expect(page.getByText(PHONE_INVALID)).toBeVisible();
    const phone: string = uniquePhone();

    await page.getByLabel("טלפון").fill(phone);
    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    expect((await fromApi(page, student))?.phone).toBe(phone);
  });
});

test.describe("edit student: saving", () => {
  test("a new name: goes to the list, the row shows it, and the old name is gone", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const name: string = uniqueName();

    await page.getByLabel("שם התלמיד").fill(name);
    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, name)).toBeVisible(SAVED);
    await expect(studentRow(page, student.name)).toHaveCount(0);
    expect((await fromApi(page, student))?.name).toBe(name);
  });

  test("a new phone typed without a hyphen is shown in the saved format", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const digits = randomDigits(7);

    await page.getByLabel("טלפון").fill(`050${digits}`);
    await save(page);

    await expect(studentRow(page, student.name).locator("td").nth(2)).toHaveText(`050-${digits}`, SAVED);
  });

  test("a new class", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const otherClass: string = CLASS_NAMES.find((name) => name !== student.class.name)!;

    await page.getByLabel("כיתה").selectOption({ label: otherClass });
    await save(page);

    await expect(studentRow(page, student.name).locator("td").nth(1)).toHaveText(otherClass, SAVED);
    expect((await fromApi(page, student))?.class.name).toBe(otherClass);
  });

  test("everything at once", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const values = {
      name: uniqueName(),
      phone: uniquePhone(),
      className: CLASS_NAMES.find((name) => name !== student.class.name)!,
    };

    await fillStudentForm(page, values);
    await save(page);

    const row = studentRow(page, values.name);
    await expect(row).toBeVisible(SAVED);
    await expect(row.locator("td").nth(1)).toHaveText(values.className);
    await expect(row.locator("td").nth(2)).toHaveText(values.phone);
  });

  test("opening the edit page again after saving shows the saved values, and the save button works", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const name: string = uniqueName();
    const digits = randomDigits(7);
    await page.getByLabel("שם התלמיד").fill(name);
    await page.getByLabel("טלפון").fill(`050${digits}`);
    await save(page);
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, name)).toBeVisible(SAVED);

    await page.getByRole("link", { name: `עריכה עבור ${name}` }).click();

    await expect(page).toHaveURL(editUrl(student));
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(name);
    // The phone is shown in the format the server saved it in, not as it was typed.
    await expect(page.getByLabel("טלפון")).toHaveValue(`050-${digits}`);
    await expect(page.getByRole("button", { name: "שמירה", exact: true })).toBeEnabled();
  });

  test("a student can be edited twice in a row, each time from the edit link", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const first: string = uniqueName();
    await page.getByLabel("שם התלמיד").fill(first);
    await save(page);
    await expect(studentRow(page, first)).toBeVisible(SAVED);
    await page.getByRole("link", { name: `עריכה עבור ${first}` }).click();
    const second: string = uniqueName();

    await page.getByLabel("שם התלמיד").fill(second);
    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, second)).toBeVisible(SAVED);
    expect((await fromApi(page, student))?.name).toBe(second);
  });

  test("saving without changes works, and keeps the student", async ({ page }) => {
    const student: TStudent = await openEditPage(page);

    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, student.name)).toBeVisible(SAVED);
    await expectUnchanged(page, student);
  });

  test("the number of students does not change", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const before: number = (await getStudentList(page.request)).length;

    await page.getByLabel("שם התלמיד").fill(uniqueName());
    await save(page);
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, student.name)).toHaveCount(0, SAVED);

    // Other tests add students at the same time, so only this student's rows are compared.
    expect((await getStudentList(page.request)).filter(({ id }) => id === student.id)).toHaveLength(1);
    expect((await getStudentList(page.request)).length).toBeGreaterThanOrEqual(before);
  });

  test("sends the three fields to this student's endpoint with PUT", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const values = { name: uniqueName(), phone: uniquePhone(), className: CLASS_NAMES[1] };
    const classId: string = (await getClassList(page.request)).find(({ name }) => name === values.className)!.id;
    const sent = page.waitForRequest(
      (request) => request.method() === "PUT" && request.url().endsWith(`/api/students/${student.id}`),
    );

    await fillStudentForm(page, values);
    await save(page);

    expect((await sent).postDataJSON()).toEqual({ name: values.name, phone: values.phone, classId });
  });

  test("the change is still there after a reload", async ({ page }) => {
    await openEditPage(page);
    const name: string = uniqueName();
    await page.getByLabel("שם התלמיד").fill(name);
    await save(page);
    await expect(studentRow(page, name)).toBeVisible(SAVED);

    await page.reload();

    await expect(studentRow(page, name)).toBeVisible();
  });

  test("while saving, the submit button is disabled and says so, until the page changes", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await routePut(page, student, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.getByLabel("שם התלמיד").fill(uniqueName());

    await save(page);

    await expect(page.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
  });
});

test.describe("edit student: errors from the server", () => {
  test("a duplicate (another student has that name and phone) shows the message, and can be fixed", async ({
    page,
  }) => {
    const student: TStudent = await openEditPage(page);
    const other: TStudent = await createStudent(page.request);

    await page.getByLabel("שם התלמיד").fill(other.name);
    await page.getByLabel("טלפון").fill(other.phone);
    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.studentExists)).toBeVisible();
    await expect(page).toHaveURL(editUrl(student));
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(other.name);
    await expectUnchanged(page, student);

    await page.getByLabel("טלפון").fill(uniquePhone());
    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
  });

  test("when the student was deleted meanwhile, shows the message and stays on the page", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    expect((await page.request.delete(`/api/students/${student.id}`)).status()).toBe(200);

    await page.getByLabel("שם התלמיד").fill(uniqueName());
    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.studentNotFound)).toBeVisible();
    await expect(page).toHaveURL(editUrl(student));
  });

  test("shows the server's message when the class no longer exists", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await routePut(page, student, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.classNotFound }),
      }),
    );

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.classNotFound)).toBeVisible();
    await expect(page).toHaveURL(editUrl(student));
  });

  test("shows the generic message for a server error", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    await routePut(page, student, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.internal }),
      }),
    );

    await save(page);

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expectUnchanged(page, student);
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({
    page,
  }) => {
    const student: TStudent = await openEditPage(page);
    let failNext = true;
    await routePut(page, student, (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    const name: string = uniqueName();
    await page.getByLabel("שם התלמיד").fill(name);

    await save(page);
    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(name);

    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, name)).toBeVisible(SAVED);
  });
});

test.describe("edit student: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("the page fits the screen, and the student can be changed", async ({ page }) => {
    const student: TStudent = await openEditPage(page);
    const name: string = uniqueName();

    const width: number = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);

    await page.getByLabel("שם התלמיד").fill(name);
    await save(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await expect(studentRow(page, name)).toBeVisible(SAVED);
    await expect(studentRow(page, student.name)).toHaveCount(0);
  });

  test("the edit link in a row works on a narrow screen", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);
    const student: TStudent = await createStudent(page.request);
    await gotoHydrated(page, DASHBOARD_URL);

    await page.getByRole("link", { name: `עריכה עבור ${student.name}` }).click();

    await expect(page).toHaveURL(EDIT_URL);
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(student.name);
  });
});
