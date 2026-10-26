import { expect, test, type Locator, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { PAGE_SIZE } from "../constants/list.constant";
import { WRITE_SEED } from "../prisma/seed-data";
import {
  fillStudentForm,
  getStudentList,
  classField,
  gotoHydrated,
  randomDigits,
  signInAs,
  submitStudentForm,
  uniqueName,
  uniquePhone,
  type TStudentFormValues,
  findInList,
} from "./helpers";

// These tests add students through the form, so they only use a write teacher (see helpers):
// the tests that count the demo teachers' rows are not affected.
const DASHBOARD_URL = "/dashboard";
const NEW_URL = "/dashboard/students/new";
const CLASS_NAMES: string[] = WRITE_SEED.classes.map(({ name }) => name);

const NAME_TOO_SHORT = "השם חייב להכיל לפחות 2 תווים";
const NAME_BAD_CHARACTERS = "השם יכול להכיל רק אותיות, רווחים, גרש ומקף";
const PHONE_INVALID = "מספר טלפון לא תקין (לדוגמה 050-1234567)";
const CLASS_REQUIRED = "יש לבחור כיתה";

// Saving goes through the API and then to the dashboard, which can take longer than 5 seconds when
// many tests run at once.
const SAVED = { timeout: 20_000 };

const openAddPage = async (page: Page): Promise<void> => {
  await signInAs(page.request, WRITE_SEED);
  await gotoHydrated(page, NEW_URL);
};

const add = (page: Page): Promise<void> => submitStudentForm(page, "הוספה");

const validValues = (): TStudentFormValues => ({
  name: uniqueName(),
  phone: uniquePhone(),
  className: CLASS_NAMES[0],
});

const studentRow = (page: Page, name: string): Locator => page.locator("tbody tr").filter({ hasText: name });

// Tests run in parallel on the same teacher, so a global count is not stable. Checks use the
// specific student a test created instead, read through the API.
const countStudentsNamed = async (page: Page, name: string): Promise<number> =>
  (await getStudentList(page.request)).filter((student) => student.name === name).length;

const studentCount = async (page: Page): Promise<number> => {
  const heading: string = (await page.getByRole("heading", { name: /התלמידים שלי/ }).textContent()) ?? "";
  return Number(/\((\d+)\)/.exec(heading)?.[1]);
};

// Answers only the POST request, so the page can still load normally.
const routePost = (page: Page, handler: Parameters<Page["route"]>[1]) =>
  page.route("**/api/students", (route) =>
    route.request().method() === "POST" ? handler(route, route.request()) : route.continue(),
  );

test.describe("add student: getting to the page", () => {
  test("the add link is next to the students heading and opens the add page", async ({ page }) => {
    await signInAs(page.request, WRITE_SEED);
    await gotoHydrated(page, DASHBOARD_URL);

    await page.getByRole("link", { name: "הוספת תלמיד" }).click();

    await expect(page).toHaveURL(NEW_URL);
    await expect(page.getByRole("heading", { name: "הוספת תלמיד" })).toBeVisible();
  });

  test("without a session it goes to the sign-in page", async ({ page }) => {
    await page.goto(NEW_URL);

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("add student: the page", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("has the three fields, empty, and the teacher's classes in the picker", async ({ page }) => {
    await expect(page.getByLabel("שם התלמיד")).toHaveValue("");
    await expect(page.getByLabel("טלפון")).toHaveValue("");
    await expect(classField(page)).toHaveValue("");
    await expect(classField(page).locator("option")).toHaveText(["בחרו כיתה", ...CLASS_NAMES]);
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ביטול" })).toBeVisible();
  });

  test("shows the page header with the teacher's name", async ({ page }) => {
    await expect(page.locator("header")).toContainText(WRITE_SEED.name);
  });

  test("focuses the name field", async ({ page }) => {
    await expect(page.getByLabel("שם התלמיד")).toBeFocused();
  });

  test("the phone field is left-to-right and shows an example", async ({ page }) => {
    const phone = page.getByLabel("טלפון");

    await expect(phone).toHaveAttribute("dir", "ltr");
    await expect(phone).toHaveAttribute("placeholder", "050-1234567");
    await expect(phone).toHaveAttribute("type", "tel");
  });

  test("the cancel link goes back to the list and adds nothing", async ({ page }) => {
    const values = validValues();
    await fillStudentForm(page, values);

    await page.getByRole("link", { name: "ביטול" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
    expect(await countStudentsNamed(page, values.name)).toBe(0);
  });

  test("the back link goes back to the list", async ({ page }) => {
    await page.getByRole("link", { name: "חזרה לרשימת התלמידים" }).click();

    await expect(page).toHaveURL(DASHBOARD_URL);
    await expect(page.getByRole("region", { name: "רשימת התלמידים" })).toBeVisible();
  });
});

test.describe("add student: validation", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("an empty form shows an error under every field, and stays on the page", async ({ page }) => {
    await add(page);

    await expect(page.getByText(NAME_TOO_SHORT)).toBeVisible();
    await expect(page.getByText(PHONE_INVALID)).toBeVisible();
    await expect(page.getByText(CLASS_REQUIRED)).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("טלפון")).toHaveAttribute("aria-invalid", "true");
    await expect(classField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(NEW_URL);
  });

  test("an invalid form saves nothing, and keeps what was typed", async ({ page }) => {
    const name = "דנה1";
    const phone = uniquePhone();
    await fillStudentForm(page, { name, phone, className: CLASS_NAMES[1] });

    await add(page);

    await expect(page.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(name);
    await expect(page.getByLabel("טלפון")).toHaveValue(phone);
    await expect(classField(page).locator("option:checked")).toHaveText(CLASS_NAMES[1]);
    expect(await countStudentsNamed(page, name)).toBe(0);
  });

  test("shows the matching message for each problem, and only for the fields that have one", async ({
    page,
  }) => {
    await fillStudentForm(page, { name: "דנה1", phone: "123", className: CLASS_NAMES[0] });

    await add(page);

    await expect(page.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    await expect(page.getByText(PHONE_INVALID)).toBeVisible();
    await expect(page.getByText(CLASS_REQUIRED)).toHaveCount(0);
    await expect(classField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("shows one message per field, never a stack", async ({ page }) => {
    await add(page);

    await expect(page.getByText(NAME_TOO_SHORT)).toHaveCount(1);
    await expect(page.locator("form span.text-red-600")).toHaveCount(3);
  });

  test("the errors go away after the problems are fixed and the form is saved", async ({ page }) => {
    await add(page);
    await expect(page.getByText(NAME_TOO_SHORT)).toBeVisible();
    const values = validValues();

    await fillStudentForm(page, values);
    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible(SAVED);
  });

  test("the old error is cleared when the next attempt starts", async ({ page }) => {
    await add(page);
    await expect(page.getByText(NAME_TOO_SHORT)).toBeVisible();

    await page.getByLabel("שם התלמיד").fill("דנה1");
    await add(page);

    await expect(page.getByText(NAME_TOO_SHORT)).toHaveCount(0);
    await expect(page.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
  });
});

test.describe("add student: saving", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("saves the student: goes to the list, and the new row shows with its class and phone", async ({
    page,
  }) => {
    const values = validValues();

    await fillStudentForm(page, values);
    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await findInList(page, values.name);
    const row = studentRow(page, values.name);
    await expect(row).toBeVisible(SAVED);
    await expect(row.locator("td").nth(1)).toHaveText(values.className);
    await expect(row.locator("td").nth(2)).toHaveText(values.phone);
    expect(await countStudentsNamed(page, values.name)).toBe(1);
  });

  test("the number in the heading matches the rows after saving, up to the 20 that a page shows", async ({ page }) => {
    await fillStudentForm(page, validValues());
    await add(page);
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);

    // The list is not searched here, so its rows are one page. The count and the rows are two queries, and other tests
    // add students at the same time, so they can differ by the student added between them. The page is loaded again
    // until they agree.
    await expect
      .poll(
        async () => {
          await page.reload();
          await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toBeVisible();
          return (await page.locator("tbody tr").count()) === Math.min(await studentCount(page), PAGE_SIZE);
        },
        { timeout: 30_000, intervals: [300] },
      )
      .toBe(true);
  });

  test("saves the student in the class that was chosen", async ({ page }) => {
    const values: TStudentFormValues = { ...validValues(), className: CLASS_NAMES[1] };

    await fillStudentForm(page, values);
    await add(page);

    await findInList(page, values.name);
    await expect(studentRow(page, values.name).locator("td").nth(1)).toHaveText(CLASS_NAMES[1], SAVED);
  });

  test("a phone typed without a hyphen is shown in the saved format", async ({ page }) => {
    const digits = randomDigits(7);
    const values: TStudentFormValues = { ...validValues(), phone: `050${digits}` };

    await fillStudentForm(page, values);
    await add(page);

    await findInList(page, values.name);
    await expect(studentRow(page, values.name).locator("td").nth(2)).toHaveText(`050-${digits}`, SAVED);
  });

  test("the saved student is still there after a reload", async ({ page }) => {
    const values = validValues();
    await fillStudentForm(page, values);
    await add(page);
    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible(SAVED);

    await page.reload();

    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible();
  });

  test("the add page is empty again after saving one, also when it is opened with the link", async ({ page }) => {
    await fillStudentForm(page, validValues());
    await add(page);
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);

    await page.getByRole("link", { name: "הוספת תלמיד" }).click();

    await expect(page).toHaveURL(NEW_URL);
    await expect(page.getByLabel("שם התלמיד")).toHaveValue("");
    await expect(page.getByLabel("טלפון")).toHaveValue("");
    await expect(classField(page)).toHaveValue("");
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toBeEnabled();
  });

  test("a second student can be added from the same page opened with the link", async ({ page }) => {
    await fillStudentForm(page, validValues());
    await add(page);
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await page.getByRole("link", { name: "הוספת תלמיד" }).click();
    const second = validValues();

    await fillStudentForm(page, second);
    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await findInList(page, second.name);
    await expect(studentRow(page, second.name)).toBeVisible(SAVED);
    expect(await countStudentsNamed(page, second.name)).toBe(1);
  });

  test("a draft that was not saved is still there when the page is opened again", async ({ page }) => {
    const name = uniqueName();
    await page.getByLabel("שם התלמיד").fill(name);
    await page.getByRole("link", { name: "ביטול" }).click();
    await expect(page).toHaveURL(DASHBOARD_URL);

    await page.getByRole("link", { name: "הוספת תלמיד" }).click();

    await expect(page.getByLabel("שם התלמיד")).toHaveValue(name);
  });

  test("while saving, the submit button is disabled and says so, until the page changes", async ({ page }) => {
    await routePost(page, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await fillStudentForm(page, validValues());

    await add(page);

    await expect(page.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
  });

  test("the form is not sent twice by a second click while saving", async ({ page }) => {
    const values = validValues();
    let posts = 0;
    await routePost(page, async (route) => {
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await fillStudentForm(page, values);

    await add(page);
    await page.getByRole("button", { name: "שומר..." }).click({ force: true, timeout: 1000 }).catch(() => {});

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    expect(posts).toBe(1);
    expect(await countStudentsNamed(page, values.name)).toBe(1);
  });
});

test.describe("add student: errors from the server", () => {
  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("a duplicate shows the server's message and keeps the form, so it can be fixed", async ({ page }) => {
    const values = validValues();
    await fillStudentForm(page, values);
    await add(page);
    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible(SAVED);

    await gotoHydrated(page, NEW_URL);
    await fillStudentForm(page, values);
    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.studentExists)).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(values.name);
    await expect(page).toHaveURL(NEW_URL);
    expect(await countStudentsNamed(page, values.name)).toBe(1);

    await page.getByLabel("טלפון").fill(uniquePhone());
    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    expect(await countStudentsNamed(page, values.name)).toBe(2);
  });

  test("shows the server's message when the class no longer exists", async ({ page }) => {
    await routePost(page, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.classNotFound }),
      }),
    );
    await fillStudentForm(page, validValues());

    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.classNotFound)).toBeVisible();
    await expect(page).toHaveURL(NEW_URL);
  });

  test("shows the generic message for a server error", async ({ page }) => {
    await routePost(page, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: ERROR_MESSAGES.internal }),
      }),
    );
    await fillStudentForm(page, validValues());

    await add(page);

    await expect(page.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(page).toHaveURL(NEW_URL);
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({
    page,
  }) => {
    let failNext = true;
    await routePost(page, (route) => {
      if (!failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    const values = validValues();
    await fillStudentForm(page, values);

    await add(page);
    await expect(page.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(page.getByLabel("שם התלמיד")).toHaveValue(values.name);

    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible(SAVED);
  });
});

test.describe("add student: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test.beforeEach(async ({ page }) => {
    await openAddPage(page);
  });

  test("the page fits the screen, and a student can be added", async ({ page }) => {
    const values = validValues();

    const width: number = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);

    await fillStudentForm(page, values);
    await add(page);

    await expect(page).toHaveURL(DASHBOARD_URL, SAVED);
    await findInList(page, values.name);
    await expect(studentRow(page, values.name)).toBeVisible(SAVED);
  });

  test("on a very short screen the submit button can still be reached", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 360 });

    const button = page.getByRole("button", { name: "הוספה", exact: true });
    await button.scrollIntoViewIfNeeded();

    await expect(button).toBeInViewport();
  });
});
