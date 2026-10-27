import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import { gotoHydrated, signInAs } from "./helpers";

// The demo teacher is only read here, so these tests cannot affect the others.
const LIST_URL = "/dashboard/assignments";
const TOTAL = 4;
const NO_RESULTS = "לא נמצאו מטלות שמתאימות לחיפוש";

const REVOLUTION = "עבודה על המהפכה התעשייתית";
const ESSAY = "חיבור: המסע שלי";
const SUMMARY = "סיכום הספר";
const MATH = "תרגילי חשבון - פרק 4";

const NEWEST_DUE_DATE = [MATH, REVOLUTION, ESSAY, SUMMARY];
const BY_TITLE = [ESSAY, SUMMARY, REVOLUTION, MATH];

const search = (page: Page): Locator => page.getByRole("searchbox", { name: "חיפוש" });
const sortSelect = (page: Page): Locator => page.getByLabel("מיון", { exact: true });
const count = (page: Page): Locator => page.getByRole("status");

const listedTitles = (page: Page): Promise<string[]> =>
  page
    .locator("tbody tr td:first-child a")
    .evaluateAll((links: Element[]) => links.map((link: Element) => (link.textContent ?? "").trim()));

const expectTitles = (page: Page, expected: readonly string[]) =>
  expect.poll(() => listedTitles(page), { message: "the titles in the table" }).toEqual(expected);

const signInAndOpen = async (page: Page, url: string = LIST_URL, seed: TSeedTeacher = DEMO_SEED): Promise<void> => {
  await signInAs(page.request, seed);
  await gotoHydrated(page, url);
};

const queryOf = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

test.describe("assignments list: the controls", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  test("shows a search box and a sort select, and no class select, in a labelled search form", async ({ page }) => {
    await expect(page.getByRole("search", { name: "סינון ומיון" })).toBeVisible();
    await expect(search(page)).toBeVisible();
    await expect(search(page)).toHaveValue("");
    await expect(sortSelect(page)).toBeVisible();
    await expect(page.getByLabel("כיתה", { exact: true })).toHaveCount(0);
  });

  test("the sort select has the eight orders, the newest due date first", async ({ page }) => {
    expect(await sortSelect(page).locator("option").allTextContents()).toEqual([
      "תאריך הגשה (החדש ראשון)",
      "תאריך הגשה (הישן ראשון)",
      "שם (א-ת)",
      "שם (ת-א)",
      "מספר תלמידים (מהרב למעט)",
      "מספר תלמידים (מהמעט לרב)",
      "הוגשו (מהרב למעט)",
      "הוגשו (מהמעט לרב)",
    ]);
    await expect(sortSelect(page)).toHaveValue("-dueDate");
  });

  test("starts with all the assignments, the newest due date first, no count line, no clear button, and a clean address", async ({
    page,
  }) => {
    await expectTitles(page, NEWEST_DUE_DATE);
    await expect(count(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ניקוי" })).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("assignments list: search", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  test("by a part of the title, written in the address, with a count line", async ({ page }) => {
    await search(page).fill("מהפכה");

    await expectTitles(page, [REVOLUTION]);
    expect(queryOf(page).get("q")).toBe("מהפכה");
    await expect(count(page)).toHaveText(`נמצאו 1 מתוך ${TOTAL}`);
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toContainText(`(${TOTAL})`);
  });

  test("by words with a colon, a hyphen and a number in them", async ({ page }) => {
    await search(page).fill("חיבור:");
    await expectTitles(page, [ESSAY]);

    await search(page).fill("- פרק 4");
    await expectTitles(page, [MATH]);
  });

  test("matches several and keeps the sort", async ({ page }) => {
    await search(page).fill("ה");

    await expectTitles(page, [REVOLUTION, ESSAY, SUMMARY]);
    await sortSelect(page).selectOption("title");
    await expectTitles(page, [ESSAY, SUMMARY, REVOLUTION]);
  });

  test("ignores spaces around the search", async ({ page }) => {
    await search(page).fill("   סיכום   ");

    await expectTitles(page, [SUMMARY]);
    expect(queryOf(page).get("q")).toBe("סיכום");
  });

  test("looks in the title only, not in the description", async ({ page }) => {
    await search(page).fill("הנחיות");

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });

  test("nothing matches: says so, keeps the controls, and the heading still has all the assignments", async ({ page }) => {
    await search(page).fill("אין מטלה כזאת");

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(count(page)).toHaveText(`נמצאו 0 מתוך ${TOTAL}`);
    await expect(page.getByRole("heading", { name: /המטלות שלי/ })).toContainText(`(${TOTAL})`);
    await expect(search(page)).toBeVisible();
    await expect(page.getByText("עדיין אין מטלות")).toHaveCount(0);
  });

  test.describe("a text that could break a query", () => {
    for (const [label, text] of [
      ["a percent sign", "%"],
      ["an underscore", "_"],
      ["a percent sign between letters", "ח%ר"],
      ["a quote", "o'brien"],
      ["a sql injection", "' OR 1=1 --"],
      ["a backslash", "\\"],
      ["html", "<script>alert(1)</script>"],
    ] as const) {
      test(`${label} is only text: it matches nothing and nothing breaks`, async ({ page }) => {
        await search(page).fill(text);

        await expect(page.getByText(NO_RESULTS)).toBeVisible();
        await expect(count(page)).toHaveText(`נמצאו 0 מתוך ${TOTAL}`);
        await expect(page.getByText("משהו השתבש")).toHaveCount(0);
      });
    }
  });

  test("clearing the box shows everything again and takes the search out of the address", async ({ page }) => {
    await search(page).fill("סיכום");
    await expectTitles(page, [SUMMARY]);

    await search(page).fill("");

    await expectTitles(page, NEWEST_DUE_DATE);
    await expect(count(page)).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("is kept when the page is reloaded", async ({ page }) => {
    await search(page).fill("סיכום");
    await expectTitles(page, [SUMMARY]);

    await page.reload();

    await expect(search(page)).toHaveValue("סיכום");
    await expectTitles(page, [SUMMARY]);
  });

  test("keys typed while the list is loading are not lost, and the box keeps the focus", async ({ page }) => {
    await search(page).click();
    await page.keyboard.type("סיכום", { delay: 450 });

    await expect(search(page)).toHaveValue("סיכום");
    await expect(search(page)).toBeFocused();
    await expectTitles(page, [SUMMARY]);
  });

  test("a sort chosen a moment after typing is not lost, and neither is the search", async ({ page }) => {
    await search(page).pressSequentially("ה", { delay: 0 });
    await sortSelect(page).selectOption("title");

    await expect(search(page)).toHaveValue("ה");
    await expect.poll(() => queryOf(page).get("sort")).toBe("title");
    await expect.poll(() => queryOf(page).get("q")).toBe("ה");
    await expectTitles(page, [ESSAY, SUMMARY, REVOLUTION]);
  });

  test("a click on a row right after typing is not taken over by the search that was still waiting", async ({ page }) => {
    // The page of the assignment is slow to arrive (longer than the pause of the search), as it is on a slow connection.
    await page.route(/\/dashboard\/assignments\/[0-9a-f-]{36}/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await search(page).fill("סיכום");

    await page.getByRole("link", { name: SUMMARY, exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/assignments\/[0-9a-f-]{36}$/);
    // Longer than the pause of the search: the search must not have been applied after the click.
    await page.waitForTimeout(900);

    await expect(page).toHaveURL(/\/dashboard\/assignments\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: SUMMARY, level: 1 })).toBeVisible();
  });

  test("the other teacher's assignments are never found", async ({ page }) => {
    await search(page).fill("קריאה");

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });

  test("the other teacher finds only their own", async ({ page }) => {
    await signInAndOpen(page, LIST_URL, OTHER_SEED);

    await search(page).fill("קריאה");
    await expectTitles(page, ["קריאה: פרק ראשון"]);
    await expect(count(page)).toHaveText("נמצאו 1 מתוך 1");

    await search(page).fill("חיבור");
    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });
});

test.describe("assignments list: sorting", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  for (const [label, value, expected] of [
    ["the newest due date", "-dueDate", NEWEST_DUE_DATE],
    ["the oldest due date", "dueDate", [...NEWEST_DUE_DATE].reverse()],
    ["title, from the start", "title", BY_TITLE],
    ["title, from the end", "-title", [...BY_TITLE].reverse()],
    // Two assignments have 2 students: the one with the later due date comes first.
    ["the most students", "-students", [MATH, REVOLUTION, ESSAY, SUMMARY]],
    ["the fewest students", "students", [ESSAY, SUMMARY, REVOLUTION, MATH]],
    // Two assignments have 2 submitted: the one with the later due date comes first.
    ["the most submitted", "-submitted", [REVOLUTION, ESSAY, SUMMARY, MATH]],
    ["the fewest submitted", "submitted", [MATH, SUMMARY, REVOLUTION, ESSAY]],
  ] as const) {
    test(`by ${label}`, async ({ page }) => {
      await sortSelect(page).selectOption(value);

      if (value === "-dueDate") await expect.poll(() => new URL(page.url()).search).toBe("");
      else await expect.poll(() => queryOf(page).get("sort")).toBe(value);
      await expectTitles(page, expected);
    });
  }

  test("the numbers in the table follow the order", async ({ page }) => {
    await sortSelect(page).selectOption("-submitted");
    await expectTitles(page, [REVOLUTION, ESSAY, SUMMARY, MATH]);

    const submitted: string[] = await page.locator("tbody tr td:nth-child(4)").allTextContents();

    expect(submitted.map((text) => Number(text.split(" ")[0]))).toEqual([2, 2, 1, 0]);
  });

  test("is kept when the page is reloaded", async ({ page }) => {
    await sortSelect(page).selectOption("students");
    await expectTitles(page, [ESSAY, SUMMARY, REVOLUTION, MATH]);

    await page.reload();

    await expect(sortSelect(page)).toHaveValue("students");
    await expectTitles(page, [ESSAY, SUMMARY, REVOLUTION, MATH]);
  });

  test("sorting alone shows no count line: nothing is filtered out", async ({ page }) => {
    await sortSelect(page).selectOption("title");
    await expectTitles(page, BY_TITLE);

    await expect(count(page)).toHaveCount(0);
  });

  test("the sort is kept when the search changes, also the sort by the number that submitted", async ({ page }) => {
    await sortSelect(page).selectOption("submitted");
    await expectTitles(page, [MATH, SUMMARY, REVOLUTION, ESSAY]);

    await search(page).fill("ה");

    await expectTitles(page, [MATH, SUMMARY, REVOLUTION, ESSAY]);
    await search(page).fill("חיבור");
    await expectTitles(page, [ESSAY]);
    await expect(sortSelect(page)).toHaveValue("submitted");
  });
});

test.describe("assignments list: clearing", () => {
  test("the clear button appears with a search or a sort, and puts everything back", async ({ page }) => {
    await signInAndOpen(page);
    const clear = page.getByRole("button", { name: "ניקוי" });
    await expect(clear).toHaveCount(0);

    await sortSelect(page).selectOption("title");
    await expect(clear).toBeVisible();
    await search(page).fill("סיכום");
    await expectTitles(page, [SUMMARY]);
    await clear.click();

    await expect(search(page)).toHaveValue("");
    await expect(sortSelect(page)).toHaveValue("-dueDate");
    await expectTitles(page, NEWEST_DUE_DATE);
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(count(page)).toHaveCount(0);
    await expect(clear).toHaveCount(0);
  });

  test("opening the assignments tab again clears the search, because the address has none", async ({ page }) => {
    await signInAndOpen(page);
    await search(page).fill("סיכום");
    await expectTitles(page, [SUMMARY]);

    await page.getByRole("link", { name: "מטלות", exact: true }).click();

    await expect(search(page)).toHaveValue("");
    await expectTitles(page, NEWEST_DUE_DATE);
  });
});

test.describe("assignments list: the address", () => {
  test("opens with the filters of the address already in the controls and in the list", async ({ page }) => {
    await signInAndOpen(page, `${LIST_URL}?q=${encodeURIComponent("ה")}&sort=-title`);

    await expect(search(page)).toHaveValue("ה");
    await expect(sortSelect(page)).toHaveValue("-title");
    await expectTitles(page, [REVOLUTION, SUMMARY, ESSAY]);
    await expect(count(page)).toHaveText(`נמצאו 3 מתוך ${TOTAL}`);
  });

  test.describe("a value that is not valid is the default, never an error", () => {
    for (const [label, query] of [
      ["a sort that does not exist", "sort=price"],
      ["a sort of the students", "sort=name"],
      ["a sort with a different case", "sort=TITLE"],
      ["a repeated search", "q=a&q=b"],
      ["a repeated sort", "sort=title&sort=-title"],
      ["a NUL character in the search", "q=%00"],
      ["only spaces in the search", "q=%20%20"],
      ["a class, which assignments do not have", "class=abc"],
      ["a param that is not known", "page=2&limit=1"],
    ] as const) {
      test(label, async ({ page }) => {
        await signInAndOpen(page, `${LIST_URL}?${query}`);

        await expectTitles(page, NEWEST_DUE_DATE);
        await expect(search(page)).toHaveValue("");
        await expect(sortSelect(page)).toHaveValue("-dueDate");
        await expect(count(page)).toHaveCount(0);
      });
    }
  });

  test("a very long search is cut to 100 characters, and the page still works", async ({ page }) => {
    await signInAndOpen(page, `${LIST_URL}?q=${"א".repeat(500)}`);

    await expect(search(page)).toHaveValue("א".repeat(100));
    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });

  test("a good value next to a bad one is still used", async ({ page }) => {
    await signInAndOpen(page, `${LIST_URL}?q=${encodeURIComponent("סיכום")}&sort=nonsense`);

    await expectTitles(page, [SUMMARY]);
    await expect(sortSelect(page)).toHaveValue("-dueDate");
  });
});

test.describe("assignments list: a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("the controls fit the screen, can all be reached and work", async ({ page }) => {
    await signInAndOpen(page);

    const fits: boolean = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    for (const control of [search(page), sortSelect(page)]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }

    await sortSelect(page).selectOption("title");
    await search(page).fill("סיכום");

    await expectTitles(page, [SUMMARY]);
    await expect(page.getByRole("button", { name: "ניקוי" })).toBeVisible();
  });
});
