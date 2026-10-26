import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  BULK_ASSIGNMENT_COUNT,
  BULK_STUDENT_COUNT,
  createBulkTeacher,
  deleteBulkTeacher,
  gotoHydrated,
  signInAs,
  type TBulkTeacher,
} from "./helpers";

// A teacher made for this file (see createBulkTeacher) with 45 students and 45 assignments, so each list has 3 pages
// of 20, 20 and 5. Students are "תלמיד 001".. (even numbers in the first class), assignments "מטלה 001".. where the
// highest number is the newest due date, and number g has g % 4 students out of 3 who submitted.
const STUDENTS_URL = "/dashboard";
const ASSIGNMENTS_URL = "/dashboard/assignments";
const PAGE_SIZE = 20;
const PAGE_COUNT = 3;
const DETAILS_PREFIX = "פרטים עבור ";

// A page is loaded from the dev server, which can take longer than 5 seconds when many tests run at once.
const LOADED = 20_000;

let teacher: TBulkTeacher;

test.beforeAll(async () => {
  teacher = await createBulkTeacher();
});

test.afterAll(async () => {
  await deleteBulkTeacher(teacher);
});

const pad = (value: number): string => String(value).padStart(3, "0");
const range = (from: number, to: number): number[] =>
  from <= to
    ? Array.from({ length: to - from + 1 }, (_, index) => from + index)
    : Array.from({ length: from - to + 1 }, (_, index) => from - index);

const studentNames = (numbers: number[]): string[] => numbers.map((number) => `תלמיד ${pad(number)}`);
const assignmentTitles = (numbers: number[]): string[] => numbers.map((number) => `מטלה ${pad(number)}`);

const pagination = (page: Page): Locator => page.getByRole("navigation", { name: "דפדוף" });
const previous = (page: Page): Locator => pagination(page).getByText("הקודם", { exact: true });
const next = (page: Page): Locator => pagination(page).getByText("הבא", { exact: true });
const pageLabel = (page: Page, current: number, count: number = PAGE_COUNT): Locator =>
  pagination(page).getByText(`עמוד ${current} מתוך ${count}`);
const search = (page: Page): Locator => page.getByRole("searchbox", { name: "חיפוש" });
const sortSelect = (page: Page): Locator => page.getByLabel("מיון", { exact: true });
const classSelect = (page: Page): Locator => page.getByLabel("כיתה", { exact: true });
const found = (page: Page): Locator => page.getByRole("status");

const listedStudents = (page: Page): Promise<string[]> =>
  page
    .locator(`tbody tr a[aria-label^="${DETAILS_PREFIX}"]`)
    .evaluateAll(
      (links: Element[], prefix: string) =>
        links.map((link: Element) => (link.getAttribute("aria-label") ?? "").slice(prefix.length)),
      DETAILS_PREFIX,
    );

const listedAssignments = (page: Page): Promise<string[]> =>
  page
    .locator("tbody tr td:first-child a")
    .evaluateAll((links: Element[]) => links.map((link: Element) => (link.textContent ?? "").trim()));

const expectStudents = (page: Page, expected: readonly string[]) =>
  expect.poll(() => listedStudents(page), { message: "the students in the table", timeout: LOADED }).toEqual(expected);

const expectAssignments = (page: Page, expected: readonly string[]) =>
  expect.poll(() => listedAssignments(page), { message: "the assignments in the table", timeout: LOADED }).toEqual(expected);

const open = async (page: Page, url: string): Promise<void> => {
  await signInAs(page.request, { name: teacher.name, idNumber: teacher.idNumber, classes: [] });
  await gotoHydrated(page, url);
};

const queryOf = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

// The query of an address the way the app writes it (a space is a plus sign).
const toQuery = (params: Record<string, string>): string => new URLSearchParams(params).toString();

// Pressing the key, not clicking: on a narrow screen the dev server's own indicator sits over the corner of the page,
// and it is not part of the app.
const activate = async (control: Locator): Promise<void> => {
  await control.focus();
  await control.press("Enter");
};

test.describe("students list: pages", () => {
  test("the first page has 20 students, the newest control states and a link to the next page", async ({ page }) => {
    await open(page, STUDENTS_URL);

    await expectStudents(page, studentNames(range(1, PAGE_SIZE)));
    await expect(pageLabel(page, 1)).toBeVisible();
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toContainText(`(${BULK_STUDENT_COUNT})`);
    await expect(found(page)).toHaveCount(0);
    await expect(next(page)).toHaveAttribute("href", "/dashboard?page=2");
    await expect(next(page)).toHaveAttribute("rel", "next");
  });

  test("on the first page 'previous' is shown but is not a link", async ({ page }) => {
    await open(page, STUDENTS_URL);

    await expect(previous(page)).toBeVisible();
    await expect(previous(page)).toHaveAttribute("aria-disabled", "true");
    await expect(pagination(page).getByRole("link", { name: "הקודם" })).toHaveCount(0);
  });

  test("'next' goes to the second page, in the address, and 'previous' comes back to a clean address", async ({ page }) => {
    await open(page, STUDENTS_URL);

    await next(page).click();

    await expectStudents(page, studentNames(range(21, 40)));
    expect(queryOf(page).get("page")).toBe("2");
    await expect(pageLabel(page, 2)).toBeVisible();
    await expect(previous(page)).toHaveAttribute("href", "/dashboard");
    await expect(next(page)).toHaveAttribute("href", "/dashboard?page=3");

    await previous(page).click();

    await expectStudents(page, studentNames(range(1, 20)));
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("the last page has the 5 that are left, and 'next' is not a link there", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?page=3`);

    await expectStudents(page, studentNames(range(41, 45)));
    await expect(pageLabel(page, 3)).toBeVisible();
    await expect(next(page)).toHaveAttribute("aria-disabled", "true");
    await expect(pagination(page).getByRole("link", { name: "הבא" })).toHaveCount(0);
    await expect(previous(page)).toHaveAttribute("href", "/dashboard?page=2");
  });

  test("going through all the pages shows every student once, in order", async ({ page }) => {
    await open(page, STUDENTS_URL);
    const seen: string[] = [];

    for (let current = 1; current <= PAGE_COUNT; current += 1) {
      await expect(pageLabel(page, current)).toBeVisible();
      await expect.poll(async () => (await listedStudents(page)).length).toBe(current < PAGE_COUNT ? PAGE_SIZE : 5);
      seen.push(...(await listedStudents(page)));
      if (current < PAGE_COUNT) await next(page).click();
    }

    expect(seen).toEqual(studentNames(range(1, BULK_STUDENT_COUNT)));
  });

  test("a page can be opened by its address and kept by a reload", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?page=2`);
    await expectStudents(page, studentNames(range(21, 40)));

    await page.reload();

    await expectStudents(page, studentNames(range(21, 40)));
    await expect(pageLabel(page, 2)).toBeVisible();
  });

  test("back goes to the earlier page", async ({ page }) => {
    await open(page, STUDENTS_URL);
    await next(page).click();
    await expectStudents(page, studentNames(range(21, 40)));

    await page.goBack();

    await expectStudents(page, studentNames(range(1, 20)));
    await expect(pageLabel(page, 1)).toBeVisible();
  });

  test("a new page starts at the top of the table", async ({ page }) => {
    await open(page, STUDENTS_URL);
    const table = page.getByRole("region", { name: "רשימת התלמידים" });
    await table.evaluate((element: Element) => element.scrollTo(0, 10_000));

    await next(page).click();
    await expectStudents(page, studentNames(range(21, 40)));

    expect(await table.evaluate((element: Element) => element.scrollTop)).toBe(0);
  });

  test.describe("a page that is not valid is the first page, or the last when it is past the end", () => {
    for (const [label, query, expectedPage, expectedNumbers] of [
      ["past the end", "page=99", 3, range(41, 45)],
      ["a huge number", "page=999999", 3, range(41, 45)],
      ["a number too long to be a page", "page=99999999999999999999", 1, range(1, 20)],
      ["zero", "page=0", 1, range(1, 20)],
      ["a negative number", "page=-2", 1, range(1, 20)],
      ["a decimal", "page=1.5", 1, range(1, 20)],
      ["an exponent", "page=2e0", 1, range(1, 20)],
      ["letters", "page=abc", 1, range(1, 20)],
      ["empty", "page=", 1, range(1, 20)],
      ["repeated", "page=2&page=3", 1, range(1, 20)],
    ] as const) {
      test(label, async ({ page }) => {
        await open(page, `${STUDENTS_URL}?${query}`);

        await expectStudents(page, studentNames(expectedNumbers));
        await expect(pageLabel(page, expectedPage)).toBeVisible();
      });
    }
  });

  test("the page keeps the sort, and the sort starts again from the first page", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?sort=-name`);
    await expectStudents(page, studentNames(range(45, 26)));
    await expect(next(page)).toHaveAttribute("href", "/dashboard?sort=-name&page=2");

    await next(page).click();
    await expectStudents(page, studentNames(range(25, 6)));

    await sortSelect(page).selectOption("name");

    await expectStudents(page, studentNames(range(1, 20)));
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(pageLabel(page, 1)).toBeVisible();
  });

  test("the page keeps the search, and a new search starts again from the first page", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?q=${encodeURIComponent("תלמיד 0")}`);
    await expectStudents(page, studentNames(range(1, 20)));
    await expect(found(page)).toHaveText(`נמצאו ${BULK_STUDENT_COUNT} מתוך ${BULK_STUDENT_COUNT}`);
    await expect(next(page)).toHaveAttribute("href", `/dashboard?${toQuery({ q: "תלמיד 0", page: "2" })}`);

    await next(page).click();
    await expectStudents(page, studentNames(range(21, 40)));
    await expect(search(page)).toHaveValue("תלמיד 0");
    await expect(found(page)).toHaveText(`נמצאו ${BULK_STUDENT_COUNT} מתוך ${BULK_STUDENT_COUNT}`);

    await search(page).fill("תלמיד 03");

    await expectStudents(page, studentNames(range(30, 39)));
    await expect.poll(() => queryOf(page).get("page")).toBeNull();
    await expect(pagination(page)).toHaveCount(0);
  });

  test("the class filter has its own pages: 23 students are 2 pages, and the second has 3", async ({ page }) => {
    await open(page, STUDENTS_URL);

    await classSelect(page).selectOption({ label: teacher.classNames[1] });

    await expect(found(page)).toHaveText(`נמצאו 23 מתוך ${BULK_STUDENT_COUNT}`);
    await expect(pageLabel(page, 1, 2)).toBeVisible();
    await expect.poll(async () => (await listedStudents(page)).length).toBe(PAGE_SIZE);

    await next(page).click();

    await expect(pageLabel(page, 2, 2)).toBeVisible();
    await expectStudents(page, studentNames([41, 43, 45]));
    for (const row of await page.locator("tbody tr").all()) {
      await expect(row.locator("td").nth(1)).toHaveText(teacher.classNames[1]);
    }
  });

  test("nothing is shown for a list that fits in one page", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?q=${encodeURIComponent("תלמיד 04")}`);

    await expectStudents(page, studentNames(range(40, 45)));
    await expect(found(page)).toHaveText(`נמצאו 6 מתוך ${BULK_STUDENT_COUNT}`);
    await expect(pagination(page)).toHaveCount(0);
  });

  test("a search with no result has no pages", async ({ page }) => {
    await open(page, `${STUDENTS_URL}?q=${encodeURIComponent("אין כזה")}&page=3`);

    await expect(page.getByText("לא נמצאו תלמידים שמתאימים לחיפוש")).toBeVisible();
    await expect(pagination(page)).toHaveCount(0);
  });

  test("the pages fit a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await open(page, STUDENTS_URL);

    await expect(pageLabel(page, 1)).toBeVisible();
    for (const control of [previous(page), next(page), pageLabel(page, 1)]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await activate(next(page));
    await expectStudents(page, studentNames(range(21, 40)));
  });

  test("the heading and the table are labelled, and the pages are a navigation", async ({ page }) => {
    await open(page, STUDENTS_URL);

    await expect(pagination(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "רשימת התלמידים" })).toBeVisible();
  });
});

test.describe("assignments list: pages", () => {
  test("the first page has the 20 with the newest due date, and a link to the next page", async ({ page }) => {
    await open(page, ASSIGNMENTS_URL);

    await expectAssignments(page, assignmentTitles(range(45, 26)));
    await expect(pageLabel(page, 1)).toBeVisible();
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toContainText(`(${BULK_ASSIGNMENT_COUNT})`);
    await expect(found(page)).toHaveCount(0);
    await expect(next(page)).toHaveAttribute("href", "/dashboard/assignments?page=2");
    await expect(previous(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("'next' and 'previous' go between the pages, and the last page has the 5 that are left", async ({ page }) => {
    await open(page, ASSIGNMENTS_URL);

    await next(page).click();
    await expectAssignments(page, assignmentTitles(range(25, 6)));
    expect(queryOf(page).get("page")).toBe("2");

    await next(page).click();
    await expectAssignments(page, assignmentTitles(range(5, 1)));
    await expect(next(page)).toHaveAttribute("aria-disabled", "true");

    await previous(page).click();
    await expectAssignments(page, assignmentTitles(range(25, 6)));
    await previous(page).click();
    await expectAssignments(page, assignmentTitles(range(45, 26)));
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("a page can be opened by its address and kept by a reload", async ({ page }) => {
    await open(page, `${ASSIGNMENTS_URL}?page=3`);
    await expectAssignments(page, assignmentTitles(range(5, 1)));

    await page.reload();

    await expectAssignments(page, assignmentTitles(range(5, 1)));
    await expect(pageLabel(page, 3)).toBeVisible();
  });

  test.describe("a page that is not valid is the first page, or the last when it is past the end", () => {
    for (const [label, query, expectedPage, expectedNumbers] of [
      ["past the end", "page=99", 3, range(5, 1)],
      ["zero", "page=0", 1, range(45, 26)],
      ["a negative number", "page=-1", 1, range(45, 26)],
      ["letters", "page=x", 1, range(45, 26)],
      ["a decimal", "page=2.5", 1, range(45, 26)],
    ] as const) {
      test(label, async ({ page }) => {
        await open(page, `${ASSIGNMENTS_URL}?${query}`);

        await expectAssignments(page, assignmentTitles(expectedNumbers));
        await expect(pageLabel(page, expectedPage)).toBeVisible();
      });
    }
  });

  test("sorted by title, every assignment is on exactly one page, in order", async ({ page }) => {
    await open(page, `${ASSIGNMENTS_URL}?sort=title`);
    const seen: string[] = [];

    for (let current = 1; current <= PAGE_COUNT; current += 1) {
      await expect(pageLabel(page, current)).toBeVisible();
      await expect.poll(async () => (await listedAssignments(page)).length).toBe(current < PAGE_COUNT ? PAGE_SIZE : 5);
      seen.push(...(await listedAssignments(page)));
      if (current < PAGE_COUNT) await next(page).click();
    }

    expect(seen).toEqual(assignmentTitles(range(1, BULK_ASSIGNMENT_COUNT)));
  });

  test("the page keeps the sort in its link, and a new sort starts again from the first page", async ({ page }) => {
    await open(page, `${ASSIGNMENTS_URL}?sort=title`);
    await expect(next(page)).toHaveAttribute("href", "/dashboard/assignments?sort=title&page=2");

    await next(page).click();
    await expectAssignments(page, assignmentTitles(range(21, 40)));

    await sortSelect(page).selectOption("-title");

    await expectAssignments(page, assignmentTitles(range(45, 26)));
    await expect.poll(() => queryOf(page).get("page")).toBeNull();
    expect(queryOf(page).get("sort")).toBe("-title");
  });

  // The number that submitted is g % 4, ordered in memory and then cut into pages, so each page must be the right
  // part of the whole order. Equal counts keep the default order: the newest due date (the highest number) first.
  for (const [sort, compare] of [
    ["-submitted", (a: number, b: number): number => (b % 4) - (a % 4) || b - a],
    ["submitted", (a: number, b: number): number => (a % 4) - (b % 4) || b - a],
  ] as const) {
    test(`sorted by ${sort}, the pages are the right parts of the whole order`, async ({ page }) => {
      const expectedOrder: string[] = assignmentTitles(range(1, BULK_ASSIGNMENT_COUNT).sort(compare));
      await open(page, `${ASSIGNMENTS_URL}?sort=${sort}`);
      const seen: string[] = [];

      for (let current = 1; current <= PAGE_COUNT; current += 1) {
        await expect(pageLabel(page, current)).toBeVisible();
        const from: number = (current - 1) * PAGE_SIZE;
        await expectAssignments(page, expectedOrder.slice(from, from + PAGE_SIZE));
        seen.push(...(await listedAssignments(page)));
        if (current < PAGE_COUNT) await next(page).click();
      }

      expect(seen).toEqual(expectedOrder);
    });
  }

  test("the page keeps the search, and a new search starts again from the first page", async ({ page }) => {
    await open(page, `${ASSIGNMENTS_URL}?q=${encodeURIComponent("מטלה 0")}&sort=title`);
    await expect(found(page)).toHaveText(`נמצאו ${BULK_ASSIGNMENT_COUNT} מתוך ${BULK_ASSIGNMENT_COUNT}`);
    await expect(next(page)).toHaveAttribute(
      "href",
      `/dashboard/assignments?${toQuery({ q: "מטלה 0", sort: "title", page: "2" })}`,
    );

    await next(page).click();
    await expectAssignments(page, assignmentTitles(range(21, 40)));
    await expect(search(page)).toHaveValue("מטלה 0");

    await search(page).fill("מטלה 03");

    await expectAssignments(page, assignmentTitles(range(30, 39)));
    await expect.poll(() => queryOf(page).get("page")).toBeNull();
    await expect(pagination(page)).toHaveCount(0);
  });

  test("nothing is shown for a list that fits in one page", async ({ page }) => {
    await open(page, `${ASSIGNMENTS_URL}?q=${encodeURIComponent("מטלה 04")}`);

    await expectAssignments(page, assignmentTitles(range(45, 40)));
    await expect(pagination(page)).toHaveCount(0);
  });

  test("the pages fit a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await open(page, ASSIGNMENTS_URL);

    for (const control of [previous(page), next(page), pageLabel(page, 1)]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }
    await activate(next(page));
    await expectAssignments(page, assignmentTitles(range(25, 6)));
  });
});
