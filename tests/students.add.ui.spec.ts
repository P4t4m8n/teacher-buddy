import { expect, test, type Locator, type Page } from "@playwright/test";
import { ERROR_MESSAGES } from "../constants/error.constant";
import { WRITE_SEED } from "../prisma/seed-data";
import { getStudentList, gotoHydrated, randomDigits, signInAs, uniqueName, uniquePhone } from "./helpers";

// These tests add students through the form, so they only use a write teacher (see helpers):
// the tests that count the demo teachers' rows are not affected.
const DASHBOARD_URL = "/dashboard";
const ADD_BUTTON_NAME = "הוספת תלמיד";
const CLASS_NAMES: string[] = WRITE_SEED.classes.map(({ name }) => name);

const NAME_TOO_SHORT = "השם חייב להכיל לפחות 2 תווים";
const NAME_BAD_CHARACTERS = "השם יכול להכיל רק אותיות, רווחים, גרש ומקף";
const PHONE_INVALID = "מספר טלפון לא תקין (לדוגמה 050-1234567)";
const CLASS_REQUIRED = "יש לבחור כיתה";

type TFormValues = { name: string; phone: string; className: string };

const openDashboard = async (page: Page): Promise<void> => {
  await signInAs(page.request, WRITE_SEED);
  await gotoHydrated(page, DASHBOARD_URL);
};

const openModal = async (page: Page): Promise<Locator> => {
  await page.getByRole("button", { name: ADD_BUTTON_NAME }).click();
  const dialog: Locator = page.getByRole("dialog", { name: ADD_BUTTON_NAME });
  await expect(dialog).toBeVisible();
  return dialog;
};

const fillForm = async (dialog: Locator, { name, phone, className }: TFormValues): Promise<void> => {
  await dialog.getByLabel("שם התלמיד").fill(name);
  await dialog.getByLabel("טלפון").fill(phone);
  await dialog.getByLabel("כיתה").selectOption({ label: className });
};

const submit = (dialog: Locator): Promise<void> => dialog.getByRole("button", { name: "הוספה" }).click();

const validValues = (): TFormValues => ({
  name: uniqueName(),
  phone: uniquePhone(),
  className: CLASS_NAMES[0],
});

const studentRow = (page: Page, name: string): Locator =>
  page.locator("tbody tr").filter({ hasText: name });

// Tests run in parallel on the same teacher, so a global count is not stable. Checks use the
// specific student a test created instead, read through the API.
const countStudentsNamed = async (page: Page, name: string): Promise<number> =>
  (await getStudentList(page.request)).filter((student) => student.name === name).length;

const studentCount = async (page: Page): Promise<number> => {
  const heading: string = (await page.getByRole("heading", { name: /התלמידים שלי/ }).textContent()) ?? "";
  return Number(/\((\d+)\)/.exec(heading)?.[1]);
};

test.describe("add student: the button and the modal", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("the add button is next to the students heading", async ({ page }) => {
    const button = page.getByRole("button", { name: ADD_BUTTON_NAME });

    await expect(button).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("opens a modal with the three fields and the teacher's classes in the picker", async ({ page }) => {
    const dialog = await openModal(page);

    await expect(dialog.getByLabel("שם התלמיד")).toBeVisible();
    await expect(dialog.getByLabel("טלפון")).toBeVisible();
    await expect(dialog.getByLabel("כיתה").locator("option")).toHaveText(["בחרו כיתה", ...CLASS_NAMES]);
    await expect(dialog.getByRole("button", { name: "הוספה" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ביטול" })).toBeVisible();
  });

  test("the picker only has this teacher's classes", async ({ page }) => {
    const dialog = await openModal(page);

    await expect(dialog.getByLabel("כיתה").locator("option")).toHaveCount(CLASS_NAMES.length + 1);
  });

  test("focuses the name field when it opens", async ({ page }) => {
    const dialog = await openModal(page);

    await expect(dialog.getByLabel("שם התלמיד")).toBeFocused();
  });

  test("the phone field is left-to-right and shows an example", async ({ page }) => {
    const dialog = await openModal(page);
    const phone = dialog.getByLabel("טלפון");

    await expect(phone).toHaveAttribute("dir", "ltr");
    await expect(phone).toHaveAttribute("placeholder", "050-1234567");
    await expect(phone).toHaveAttribute("type", "tel");
  });

  test("the page behind the open modal cannot be clicked", async ({ page }) => {
    await openModal(page);

    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    // A trial click only checks whether the element would receive the click: the modal covers it.
    await expect(
      page.getByRole("button", { name: "התנתקות" }).click({ trial: true, timeout: 1000 }),
    ).rejects.toThrow();
  });
});

test.describe("add student: closing", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("the cancel button closes the modal", async ({ page }) => {
    const dialog = await openModal(page);

    await dialog.getByRole("button", { name: "ביטול" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the close icon closes the modal", async ({ page }) => {
    const dialog = await openModal(page);

    await dialog.getByRole("button", { name: "סגירה" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Escape closes the modal", async ({ page }) => {
    await openModal(page);

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a tap on the backdrop does not close it, so a typed form is not lost", async ({ page }) => {
    const dialog = await openModal(page);
    await dialog.getByLabel("שם התלמיד").fill("דנה");

    await page.mouse.click(4, 4);

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("שם התלמיד")).toHaveValue("דנה");
  });

  test("reopening shows an empty form with no errors", async ({ page }) => {
    const first = await openModal(page);
    await first.getByLabel("שם התלמיד").fill("דנה1");
    await submit(first);
    await expect(first.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    await first.getByRole("button", { name: "ביטול" }).click();

    const second = await openModal(page);

    await expect(second.getByLabel("שם התלמיד")).toHaveValue("");
    await expect(second.getByLabel("טלפון")).toHaveValue("");
    await expect(second.getByLabel("כיתה")).toHaveValue("");
    await expect(second.getByText(NAME_BAD_CHARACTERS)).toHaveCount(0);
  });

  test("closing without saving adds nothing", async ({ page }) => {
    const values = validValues();
    const dialog = await openModal(page);
    await fillForm(dialog, values);

    await dialog.getByRole("button", { name: "ביטול" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await countStudentsNamed(page, values.name)).toBe(0);
    await expect(studentRow(page, values.name)).toHaveCount(0);
  });
});

test.describe("add student: validation", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("an empty form shows an error under every field, and the modal stays open", async ({ page }) => {
    const dialog = await openModal(page);

    await submit(dialog);

    await expect(dialog.getByText(NAME_TOO_SHORT)).toBeVisible();
    await expect(dialog.getByText(PHONE_INVALID)).toBeVisible();
    await expect(dialog.getByText(CLASS_REQUIRED)).toBeVisible();
    await expect(dialog.getByLabel("שם התלמיד")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabel("טלפון")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabel("כיתה")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog).toBeVisible();
  });

  test("an invalid form saves nothing", async ({ page }) => {
    const name = "דנה1";
    const dialog = await openModal(page);
    await fillForm(dialog, { name, phone: uniquePhone(), className: CLASS_NAMES[0] });

    await submit(dialog);

    await expect(dialog.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    expect(await countStudentsNamed(page, name)).toBe(0);
  });

  test("shows the matching message for each problem, and only for the fields that have one", async ({
    page,
  }) => {
    const dialog = await openModal(page);
    await fillForm(dialog, { name: "דנה1", phone: "123", className: CLASS_NAMES[0] });

    await submit(dialog);

    await expect(dialog.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
    await expect(dialog.getByText(PHONE_INVALID)).toBeVisible();
    await expect(dialog.getByText(CLASS_REQUIRED)).toHaveCount(0);
    await expect(dialog.getByLabel("כיתה")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("shows one message per field, never a stack", async ({ page }) => {
    const dialog = await openModal(page);

    await submit(dialog);

    await expect(dialog.getByText(NAME_TOO_SHORT)).toHaveCount(1);
    await expect(dialog.locator("span.text-red-600")).toHaveCount(3);
  });

  test("the errors go away after the problems are fixed and the form is saved", async ({ page }) => {
    const dialog = await openModal(page);
    await submit(dialog);
    await expect(dialog.getByText(NAME_TOO_SHORT)).toBeVisible();
    const values = validValues();

    await fillForm(dialog, values);
    await submit(dialog);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(studentRow(page, values.name)).toBeVisible();
  });
});

test.describe("add student: saving", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("saves the student: the modal closes and the new row shows with its class and phone", async ({
    page,
  }) => {
    const values = validValues();
    const dialog = await openModal(page);

    await fillForm(dialog, values);
    await submit(dialog);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = studentRow(page, values.name);
    await expect(row).toBeVisible();
    await expect(row.locator("td").nth(1)).toHaveText(values.className);
    await expect(row.locator("td").nth(2)).toHaveText(values.phone);
    expect(await countStudentsNamed(page, values.name)).toBe(1);
  });

  test("the number in the heading matches the rows after saving", async ({ page }) => {
    const values = validValues();
    const dialog = await openModal(page);
    await fillForm(dialog, values);
    await submit(dialog);
    await expect(studentRow(page, values.name)).toBeVisible();

    const headingCount: number = await studentCount(page);

    expect(await page.locator("tbody tr").count()).toBe(headingCount);
  });

  test("saves the student in the class that was chosen", async ({ page }) => {
    const values: TFormValues = { ...validValues(), className: CLASS_NAMES[1] };
    const dialog = await openModal(page);

    await fillForm(dialog, values);
    await submit(dialog);

    await expect(studentRow(page, values.name).locator("td").nth(1)).toHaveText(CLASS_NAMES[1]);
  });

  test("a phone typed without a hyphen is shown in the saved format", async ({ page }) => {
    const digits = randomDigits(7);
    const values: TFormValues = { ...validValues(), phone: `050${digits}` };
    const dialog = await openModal(page);

    await fillForm(dialog, values);
    await submit(dialog);

    await expect(studentRow(page, values.name).locator("td").nth(2)).toHaveText(`050-${digits}`);
  });

  test("the saved student is still there after a reload", async ({ page }) => {
    const values = validValues();
    const dialog = await openModal(page);
    await fillForm(dialog, values);
    await submit(dialog);
    await expect(studentRow(page, values.name)).toBeVisible();

    await page.reload();

    await expect(studentRow(page, values.name)).toBeVisible();
  });

  test("the add button works again right after saving, and starts with an empty form", async ({ page }) => {
    const first = await openModal(page);
    await fillForm(first, validValues());
    await submit(first);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const second = await openModal(page);

    await expect(second.getByLabel("שם התלמיד")).toHaveValue("");
    const values = validValues();
    await fillForm(second, values);
    await submit(second);
    await expect(studentRow(page, values.name)).toBeVisible();
  });

  test("while saving, the buttons are disabled and the submit button says so", async ({ page }) => {
    await page.route("**/api/students", async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    const dialog = await openModal(page);
    await fillForm(dialog, validValues());

    await submit(dialog);

    await expect(dialog.getByRole("button", { name: "שומר..." })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "ביטול" })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("add student: errors from the server", () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("a duplicate shows the server's message and keeps the form, so it can be fixed", async ({ page }) => {
    const values = validValues();
    const first = await openModal(page);
    await fillForm(first, values);
    await submit(first);
    await expect(studentRow(page, values.name)).toBeVisible();

    const second = await openModal(page);
    await fillForm(second, values);
    await submit(second);

    await expect(second.getByText(ERROR_MESSAGES.studentExists)).toBeVisible();
    await expect(second.getByLabel("שם התלמיד")).toHaveValue(values.name);
    expect(await countStudentsNamed(page, values.name)).toBe(1);

    await second.getByLabel("טלפון").fill(uniquePhone());
    await submit(second);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await countStudentsNamed(page, values.name)).toBe(2);
  });

  test("shows the server's message when the class no longer exists", async ({ page }) => {
    await page.route("**/api/students", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: ERROR_MESSAGES.classNotFound }),
          })
        : route.continue(),
    );
    const dialog = await openModal(page);
    await fillForm(dialog, validValues());

    await submit(dialog);

    await expect(dialog.getByText(ERROR_MESSAGES.classNotFound)).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("shows the generic message for a server error", async ({ page }) => {
    await page.route("**/api/students", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: ERROR_MESSAGES.internal }),
          })
        : route.continue(),
    );
    const dialog = await openModal(page);
    await fillForm(dialog, validValues());

    await submit(dialog);

    await expect(dialog.getByText(ERROR_MESSAGES.internal)).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("with no connection shows the network message, and the same form can be sent again", async ({
    page,
  }) => {
    let failNext = true;
    await page.route("**/api/students", (route) => {
      if (route.request().method() !== "POST" || !failNext) return route.continue();
      failNext = false;
      return route.abort("failed");
    });
    const values = validValues();
    const dialog = await openModal(page);
    await fillForm(dialog, values);

    await submit(dialog);
    await expect(dialog.getByText(ERROR_MESSAGES.network)).toBeVisible();
    await expect(dialog.getByLabel("שם התלמיד")).toHaveValue(values.name);

    await submit(dialog);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(studentRow(page, values.name)).toBeVisible();
  });

  test("the old error is cleared when the next attempt starts", async ({ page }) => {
    const dialog = await openModal(page);
    await submit(dialog);
    await expect(dialog.getByText(NAME_TOO_SHORT)).toBeVisible();

    await dialog.getByLabel("שם התלמיד").fill("דנה1");
    await submit(dialog);

    await expect(dialog.getByText(NAME_TOO_SHORT)).toHaveCount(0);
    await expect(dialog.getByText(NAME_BAD_CHARACTERS)).toBeVisible();
  });
});

test.describe("add student: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test("the modal fits the screen, and a student can be added", async ({ page }) => {
    const values = validValues();
    const dialog = await openModal(page);

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(700);

    await fillForm(dialog, values);
    await submit(dialog);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(studentRow(page, values.name)).toBeVisible();
  });

  test("on a very short screen the modal scrolls instead of being cut off", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 360 });
    const dialog = await openModal(page);

    const sizes = await dialog.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    const box = await dialog.boundingBox();

    expect(box!.y + box!.height).toBeLessThanOrEqual(360);
    expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);
    await dialog.getByRole("button", { name: "הוספה" }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "הוספה" })).toBeInViewport();
  });
});
