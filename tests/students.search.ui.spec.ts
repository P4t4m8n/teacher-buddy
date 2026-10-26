import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_SEED, OTHER_SEED, type TSeedTeacher } from "../prisma/seed-data";
import { getClassList, gotoHydrated, signInAs } from "./helpers";

// The demo teacher is only read here, so these tests cannot affect the others. Its students are:
//   ח'1: נועה לוי 050-1234567, איתי ברק 052-7654321, מאיה אברהם 054-1112233
//   ח'2: יובל כהן 050-2223344, תמר שפירא 052-3334455, אורי מזרחי 053-4445566
//   ט'1: שיר דהן 054-5556677, אמיר פרץ 050-6667788, ליאור בן דוד 052-7778899, רוני אזולאי 058-8889900
const DASHBOARD_URL = "/dashboard";
const TOTAL = 10;
const DETAILS_PREFIX = "פרטים עבור ";
const NO_RESULTS = "לא נמצאו תלמידים שמתאימים לחיפוש";

const BY_NAME = [
  "אורי מזרחי",
  "איתי ברק",
  "אמיר פרץ",
  "יובל כהן",
  "ליאור בן דוד",
  "מאיה אברהם",
  "נועה לוי",
  "רוני אזולאי",
  "שיר דהן",
  "תמר שפירא",
];
const BY_CLASS = [
  "איתי ברק",
  "מאיה אברהם",
  "נועה לוי",
  "אורי מזרחי",
  "יובל כהן",
  "תמר שפירא",
  "אמיר פרץ",
  "ליאור בן דוד",
  "רוני אזולאי",
  "שיר דהן",
];
const BY_CLASS_DESCENDING = [
  "אמיר פרץ",
  "ליאור בן דוד",
  "רוני אזולאי",
  "שיר דהן",
  "אורי מזרחי",
  "יובל כהן",
  "תמר שפירא",
  "איתי ברק",
  "מאיה אברהם",
  "נועה לוי",
];
const BY_PHONE = [
  "נועה לוי",
  "יובל כהן",
  "אמיר פרץ",
  "תמר שפירא",
  "איתי ברק",
  "ליאור בן דוד",
  "אורי מזרחי",
  "מאיה אברהם",
  "שיר דהן",
  "רוני אזולאי",
];

const search = (page: Page): Locator => page.getByRole("searchbox", { name: "חיפוש" });
const classSelect = (page: Page): Locator => page.getByLabel("כיתה", { exact: true });
const sortSelect = (page: Page): Locator => page.getByLabel("מיון", { exact: true });
const count = (page: Page): Locator => page.getByRole("status");

// The names in the table, in the order they are shown (the name is in the label of the details link).
const listedNames = (page: Page): Promise<string[]> =>
  page
    .locator(`tbody tr a[aria-label^="${DETAILS_PREFIX}"]`)
    .evaluateAll(
      (links: Element[], prefix: string) =>
        links.map((link: Element) => (link.getAttribute("aria-label") ?? "").slice(prefix.length)),
      DETAILS_PREFIX,
    );

const expectNames = (page: Page, expected: string[]) =>
  expect.poll(() => listedNames(page), { message: "the names in the table" }).toEqual(expected);

const classId = async (page: Page, className: string): Promise<string> => {
  const classes = await getClassList(page.request);
  const found = classes.find(({ name }) => name === className);
  if (!found) throw new Error(`the demo teacher has no class ${className}`);
  return found.id;
};

const signInAndOpen = async (page: Page, url: string = DASHBOARD_URL, seed: TSeedTeacher = DEMO_SEED): Promise<void> => {
  await signInAs(page.request, seed);
  await gotoHydrated(page, url);
};

const queryOf = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

test.describe("students list: the controls", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  test("shows a search box, a class select and a sort select, in a labelled search form", async ({ page }) => {
    await expect(page.getByRole("search", { name: "סינון ומיון" })).toBeVisible();
    await expect(search(page)).toBeVisible();
    await expect(search(page)).toHaveValue("");
    await expect(classSelect(page)).toBeVisible();
    await expect(sortSelect(page)).toBeVisible();
  });

  test("the class select has all the classes, also one with no students, and the first option is all of them", async ({ page }) => {
    const options = await classSelect(page).locator("option").allTextContents();

    expect(options).toEqual(["כל הכיתות", ...DEMO_SEED.classes.map(({ name }) => name)]);
    await expect(classSelect(page)).toHaveValue("");
  });

  test("the sort select has the six orders, by name first", async ({ page }) => {
    expect(await sortSelect(page).locator("option").allTextContents()).toEqual([
      "שם (א-ת)",
      "שם (ת-א)",
      "כיתה (א-ת)",
      "כיתה (ת-א)",
      "טלפון (עולה)",
      "טלפון (יורד)",
    ]);
    await expect(sortSelect(page)).toHaveValue("name");
  });

  test("starts with all the students by name, no count line and no clear button, and the address is clean", async ({ page }) => {
    await expectNames(page, BY_NAME);
    await expect(count(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ניקוי" })).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("students list: search", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  test("by a part of the name, written in the address, with a count line", async ({ page }) => {
    await search(page).fill("כהן");

    await expectNames(page, ["יובל כהן"]);
    await expect(page).toHaveURL(/[?&]q=/);
    expect(queryOf(page).get("q")).toBe("כהן");
    await expect(count(page)).toHaveText(`נמצאו 1 מתוך ${TOTAL}`);
  });

  test("by the first name, and by a part from the middle of a name", async ({ page }) => {
    await search(page).fill("יובל");
    await expectNames(page, ["יובל כהן"]);

    await search(page).fill("יאור");
    await expectNames(page, ["ליאור בן דוד"]);
  });

  test("matches several students and keeps the sort", async ({ page }) => {
    await search(page).fill("ר");

    await expectNames(page, BY_NAME.filter((name) => name !== "יובל כהן" && name !== "נועה לוי"));
  });

  test("by a part of the phone", async ({ page }) => {
    await search(page).fill("050");

    await expectNames(page, ["אמיר פרץ", "יובל כהן", "נועה לוי"]);
    await expect(count(page)).toHaveText(`נמצאו 3 מתוך ${TOTAL}`);
  });

  test("by a phone typed with no hyphen, the way people type it", async ({ page }) => {
    await search(page).fill("0501234567");

    await expectNames(page, ["נועה לוי"]);
  });

  test("by a phone typed with the hyphen", async ({ page }) => {
    await search(page).fill("050-1234567");

    await expectNames(page, ["נועה לוי"]);
  });

  test("by digits that stop right after the code", async ({ page }) => {
    await search(page).fill("0521");
    await expectNames(page, []);

    await search(page).fill("05276");
    await expectNames(page, ["איתי ברק"]);
  });

  test("ignores spaces around the search", async ({ page }) => {
    await search(page).fill("   כהן   ");

    await expectNames(page, ["יובל כהן"]);
    expect(queryOf(page).get("q")).toBe("כהן");
  });

  test("a search with a space inside it is one search", async ({ page }) => {
    await search(page).fill("בן דוד");

    await expectNames(page, ["ליאור בן דוד"]);
  });

  test("nothing matches: says so, keeps the controls, and the heading still has all the students", async ({ page }) => {
    await search(page).fill("אין תלמיד כזה");

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
    await expect(count(page)).toHaveText(`נמצאו 0 מתוך ${TOTAL}`);
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toContainText(`(${TOTAL})`);
    await expect(search(page)).toBeVisible();
    await expect(page.getByText("עדיין אין תלמידים")).toHaveCount(0);
  });

  test.describe("a text that could break a query", () => {
    for (const [label, text] of [
      ["a percent sign", "%"],
      ["an underscore", "_"],
      ["a percent sign between letters", "י%ל"],
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

  test("clearing the box shows everyone again and takes the search out of the address", async ({ page }) => {
    await search(page).fill("כהן");
    await expectNames(page, ["יובל כהן"]);

    await search(page).fill("");

    await expectNames(page, BY_NAME);
    await expect(count(page)).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("the search is kept when the page is reloaded", async ({ page }) => {
    await search(page).fill("כהן");
    await expectNames(page, ["יובל כהן"]);

    await page.reload();

    await expect(search(page)).toHaveValue("כהן");
    await expectNames(page, ["יובל כהן"]);
  });

  test("keys typed while the list is loading are not lost, and the box keeps the focus", async ({ page }) => {
    await search(page).click();
    await page.keyboard.type("תמר", { delay: 450 });

    await expect(search(page)).toHaveValue("תמר");
    await expect(search(page)).toBeFocused();
    await expectNames(page, ["תמר שפירא"]);
    expect(queryOf(page).get("q")).toBe("תמר");
  });

  test("does not search on every key: the address stays the same while typing fast", async ({ page }) => {
    await search(page).click();
    await page.keyboard.type("שיר", { delay: 40 });

    expect(queryOf(page).get("q")).toBeNull();
    await expectNames(page, ["שיר דהן"]);
    expect(queryOf(page).get("q")).toBe("שיר");
  });

  test("a click on a row right after typing is not taken over by the search that was still waiting", async ({ page }) => {
    // The page of the student is slow to arrive (longer than the pause of the search), as it is on a slow connection.
    await page.route(/\/dashboard\/students\/[0-9a-f-]{36}/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });
    await search(page).fill("כהן");

    await page.getByRole("link", { name: "פרטים עבור יובל כהן" }).click();
    await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]{36}$/);
    // Longer than the pause of the search: the search must not have been applied after the click.
    await page.waitForTimeout(900);

    await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "יובל כהן", level: 1 })).toBeVisible();
  });

  test("leaving the box with the keyboard applies the search", async ({ page }) => {
    await search(page).fill("כהן");

    await search(page).press("Tab");

    await expectNames(page, ["יובל כהן"]);
    expect(queryOf(page).get("q")).toBe("כהן");
  });

  test("Enter searches and does not reload the page", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { marker: string }).marker = "still here";
    });
    await search(page).fill("כהן");
    await search(page).press("Enter");

    await expectNames(page, ["יובל כהן"]);
    expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe("still here");
  });

  test("opening the students tab again clears the search, because the address has none", async ({ page }) => {
    await search(page).fill("כהן");
    await expectNames(page, ["יובל כהן"]);

    await page.getByRole("link", { name: "תלמידים", exact: true }).click();

    await expect(search(page)).toHaveValue("");
    await expectNames(page, BY_NAME);
  });
});

test.describe("students list: the class filter", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  test("shows only the students of the class, and the class is written in the address", async ({ page }) => {
    await classSelect(page).selectOption({ label: "ח'2" });

    await expectNames(page, ["אורי מזרחי", "יובל כהן", "תמר שפירא"]);
    expect(queryOf(page).get("class")).toBe(await classId(page, "ח'2"));
    await expect(count(page)).toHaveText(`נמצאו 3 מתוך ${TOTAL}`);
    for (const row of await page.locator("tbody tr").all()) await expect(row.locator("td").nth(1)).toHaveText("ח'2");
  });

  test("works together with the search", async ({ page }) => {
    await classSelect(page).selectOption({ label: "ט'1" });
    await search(page).fill("050");

    await expectNames(page, ["אמיר פרץ"]);
    await expect(count(page)).toHaveText(`נמצאו 1 מתוך ${TOTAL}`);
  });

  test("a class with no students shows that nothing matched", async ({ page }) => {
    await classSelect(page).selectOption({ label: "י'1" });

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
    await expect(count(page)).toHaveText(`נמצאו 0 מתוך ${TOTAL}`);
  });

  test("choosing all the classes again shows everyone and takes the class out of the address", async ({ page }) => {
    await classSelect(page).selectOption({ label: "ח'1" });
    await expectNames(page, ["איתי ברק", "מאיה אברהם", "נועה לוי"]);

    await classSelect(page).selectOption({ label: "כל הכיתות" });

    await expectNames(page, BY_NAME);
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });

  test("changing the class does not lose the search that was typed a moment before", async ({ page }) => {
    await search(page).pressSequentially("ר", { delay: 0 });
    await classSelect(page).selectOption({ label: "ח'2" });

    await expect(search(page)).toHaveValue("ר");
    await expect.poll(() => queryOf(page).get("q")).toBe("ר");
    await expectNames(page, ["אורי מזרחי", "תמר שפירא"]);
  });

  test("the class is kept when the page is reloaded", async ({ page }) => {
    await classSelect(page).selectOption({ label: "ח'1" });
    await expectNames(page, ["איתי ברק", "מאיה אברהם", "נועה לוי"]);

    await page.reload();

    await expect(classSelect(page)).toHaveValue(await classId(page, "ח'1"));
    await expectNames(page, ["איתי ברק", "מאיה אברהם", "נועה לוי"]);
  });
});

test.describe("students list: sorting", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpen(page);
  });

  for (const [label, value, expected] of [
    ["name, from the start", "name", BY_NAME],
    ["name, from the end", "-name", [...BY_NAME].reverse()],
    ["class, from the start, and by name inside a class", "class", BY_CLASS],
    ["class, from the end, and by name inside a class", "-class", BY_CLASS_DESCENDING],
    ["phone, lowest first", "phone", BY_PHONE],
    ["phone, highest first", "-phone", [...BY_PHONE].reverse()],
  ] as const) {
    test(`by ${label}`, async ({ page }) => {
      await sortSelect(page).selectOption(value);

      await expectNames(page, expected);
      if (value === "name") await expect.poll(() => new URL(page.url()).search).toBe("");
      else expect(queryOf(page).get("sort")).toBe(value);
    });
  }

  test("is kept when the page is reloaded", async ({ page }) => {
    await sortSelect(page).selectOption("-phone");
    await expectNames(page, [...BY_PHONE].reverse());

    await page.reload();

    await expect(sortSelect(page)).toHaveValue("-phone");
    await expectNames(page, [...BY_PHONE].reverse());
  });

  test("sorting alone shows no count line: nothing is filtered out", async ({ page }) => {
    await sortSelect(page).selectOption("class");
    await expectNames(page, BY_CLASS);

    await expect(count(page)).toHaveCount(0);
  });

  test("works together with the search", async ({ page }) => {
    await search(page).fill("050");
    await sortSelect(page).selectOption("-phone");

    await expectNames(page, ["אמיר פרץ", "יובל כהן", "נועה לוי"]);

    await sortSelect(page).selectOption("phone");

    await expectNames(page, ["נועה לוי", "יובל כהן", "אמיר פרץ"]);
  });

  test("the sort is kept when the search changes", async ({ page }) => {
    await sortSelect(page).selectOption("-name");
    await expectNames(page, [...BY_NAME].reverse());

    await search(page).fill("050");

    await expectNames(page, ["נועה לוי", "יובל כהן", "אמיר פרץ"]);
    await expect(sortSelect(page)).toHaveValue("-name");
  });
});

test.describe("students list: clearing", () => {
  test("the clear button appears with a search, a class or a sort, and puts everything back", async ({ page }) => {
    await signInAndOpen(page);
    const clear = page.getByRole("button", { name: "ניקוי" });
    await expect(clear).toHaveCount(0);

    await search(page).fill("כהן");
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(clear).toHaveCount(0);

    await sortSelect(page).selectOption("-phone");
    await expect(clear).toBeVisible();
    await clear.click();

    await classSelect(page).selectOption({ label: "ח'1" });
    await search(page).fill("נועה");
    await expectNames(page, ["נועה לוי"]);
    await clear.click();

    await expect(search(page)).toHaveValue("");
    await expect(classSelect(page)).toHaveValue("");
    await expect(sortSelect(page)).toHaveValue("name");
    await expectNames(page, BY_NAME);
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await expect(count(page)).toHaveCount(0);
  });

  test("a search still waiting for the pause does not come back after the clear button", async ({ page }) => {
    await signInAndOpen(page, `${DASHBOARD_URL}?q=${encodeURIComponent("כהן")}`);
    await expectNames(page, ["יובל כהן"]);

    await search(page).pressSequentially("x", { delay: 0 });
    await page.getByRole("button", { name: "ניקוי" }).click();
    await page.waitForTimeout(700);

    await expect(search(page)).toHaveValue("");
    await expectNames(page, BY_NAME);
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("students list: the address", () => {
  test("opens with the filters of the address already in the controls and in the list", async ({ page }) => {
    const id = await (async () => {
      await signInAs(page.request, DEMO_SEED);
      return classId(page, "ט'1");
    })();

    await gotoHydrated(page, `${DASHBOARD_URL}?q=${encodeURIComponent("0")}&class=${id}&sort=-phone`);

    await expect(search(page)).toHaveValue("0");
    await expect(classSelect(page)).toHaveValue(id);
    await expect(sortSelect(page)).toHaveValue("-phone");
    await expectNames(page, ["רוני אזולאי", "שיר דהן", "ליאור בן דוד", "אמיר פרץ"]);
    await expect(count(page)).toHaveText(`נמצאו 4 מתוך ${TOTAL}`);
  });

  test.describe("a value that is not valid is the default, never an error", () => {
    for (const [label, query] of [
      ["a sort that does not exist", "sort=price"],
      ["a sort of the assignments", "sort=-dueDate"],
      ["a sort with a different case", "sort=NAME"],
      ["a class that is not a uuid", "class=abc"],
      ["a class id that does not exist", "class=0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5fff"],
      ["a repeated search", "q=a&q=b"],
      ["a search written as a list", "q[]=a"],
      ["a repeated sort", "sort=name&sort=-name"],
      ["a NUL character in the search", "q=%00"],
      ["only spaces in the search", "q=%20%20"],
      ["a param that is not known", "page=2&limit=1"],
    ] as const) {
      test(label, async ({ page }) => {
        await signInAndOpen(page, `${DASHBOARD_URL}?${query}`);

        await expectNames(page, BY_NAME);
        await expect(search(page)).toHaveValue("");
        await expect(classSelect(page)).toHaveValue("");
        await expect(sortSelect(page)).toHaveValue("name");
        await expect(count(page)).toHaveCount(0);
      });
    }
  });

  test("a broken percent code in the search is only text: the page works and nothing matches", async ({ page }) => {
    await signInAndOpen(page, `${DASHBOARD_URL}?q=%E0%A4%A`);

    await expect(page.getByText(NO_RESULTS)).toBeVisible();
    await expect(page.getByRole("heading", { name: /התלמידים שלי/ })).toBeVisible();
  });
  test("a very long search is cut to 100 characters, and the page still works", async ({ page }) => {
    await signInAndOpen(page, `${DASHBOARD_URL}?q=${"א".repeat(500)}`);

    await expect(search(page)).toHaveValue("א".repeat(100));
    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });

  test("a good value next to a bad one is still used", async ({ page }) => {
    await signInAndOpen(page, `${DASHBOARD_URL}?q=${encodeURIComponent("כהן")}&sort=nonsense&class=abc`);

    await expectNames(page, ["יובל כהן"]);
    await expect(sortSelect(page)).toHaveValue("name");
  });

  test("another teacher's class id is ignored: the select shows all the classes and nothing is leaked", async ({ page, request }) => {
    await signInAs(request, OTHER_SEED);
    const [otherClass] = await getClassList(request);
    await signInAndOpen(page, `${DASHBOARD_URL}?class=${otherClass.id}`);

    await expectNames(page, BY_NAME);
    await expect(classSelect(page)).toHaveValue("");
    await expect(page.getByText(otherClass.name)).toHaveCount(0);
    for (const { students } of OTHER_SEED.classes) {
      for (const { name } of students) await expect(page.getByText(name)).toHaveCount(0);
    }
  });

  test("the search never shows another teacher's students", async ({ page }) => {
    await signInAndOpen(page);

    await search(page).fill("גולן");
    await expect(page.getByText(NO_RESULTS)).toBeVisible();
    await search(page).fill("050-9998877");
    await expect(page.getByText(NO_RESULTS)).toBeVisible();
  });

  test("the other teacher searches only their own students", async ({ page }) => {
    await signInAndOpen(page, DASHBOARD_URL, OTHER_SEED);

    await search(page).fill("050");
    await expectNames(page, ["דוד גולן"]);
    await expect(count(page)).toHaveText("נמצאו 1 מתוך 2");
  });
});

test.describe("students list: a narrow screen", () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test("the controls fit the screen, can all be reached and work", async ({ page }) => {
    await signInAndOpen(page);

    const fits: boolean = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    for (const control of [search(page), classSelect(page), sortSelect(page)]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }

    await classSelect(page).selectOption({ label: "ח'2" });
    await search(page).fill("תמר");

    await expectNames(page, ["תמר שפירא"]);
    await expect(page.getByRole("button", { name: "ניקוי" })).toBeVisible();
  });
});
