import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_SEED, OTHER_SEED } from "../prisma/seed-data";
import type { TTeacherAssignment } from "../types/assignment.type";
import { findByTitle, getAssignmentsWithStudents, gotoHydrated, signInAs } from "./helpers";

// The pages only show a form for now (nothing is saved yet), so the demo teacher is safe to use.
const LIST_URL = "/dashboard/assignments";
const NEW_URL = "/dashboard/assignments/new";
// The assignment of the seed that the edit page tests open.
const EDITED_TITLE = "עבודה על המהפכה התעשייתית";
const editUrlOf = ({ id }: TTeacherAssignment): string => `/dashboard/assignments/${id}/edit`;
const toolbar = (page: Page): Locator => page.getByRole("toolbar", { name: "עיצוב טקסט" });
const editor = (page: Page): Locator => page.getByRole("textbox", { name: "תיאור המטלה" });
const button = (page: Page, name: string): Locator => toolbar(page).getByRole("button", { name, exact: true });
const hiddenHtml = (page: Page): Locator => page.locator('input[name="description"]');

// Formatting buttons give the focus back to the editor on the next animation frame. Typing before that
// would go nowhere, so tests wait for it.
const format = async (page: Page, name: string): Promise<void> => {
  await button(page, name).click();
  await expect(editor(page)).toBeFocused();
};

const openPage = async (page: Page, url: string): Promise<void> => {
  await signInAs(page.request, DEMO_SEED);
  await gotoHydrated(page, url);
  // The editor is created after the page loads, so its toolbar shows up a moment later.
  await expect(toolbar(page)).toBeVisible();
};

// The assignment of the seed, read through the API with the demo teacher signed in.
const loadEdited = async (page: Page): Promise<TTeacherAssignment> => {
  await signInAs(page.request, DEMO_SEED);
  return findByTitle(await getAssignmentsWithStudents(page.request), EDITED_TITLE);
};

// Opens the edit page of that assignment, and gives the assignment so the test can compare with it.
const openEdit = async (page: Page): Promise<TTeacherAssignment> => {
  const assignment: TTeacherAssignment = await loadEdited(page);
  await gotoHydrated(page, editUrlOf(assignment));
  await expect(toolbar(page)).toBeVisible();
  return assignment;
};

test.describe("assignment form: the new page", () => {
  test("has the title, students, due date and description fields, with save and cancel", async ({ page }) => {
    await openPage(page, NEW_URL);

    await expect(page.getByRole("heading", { name: "מטלה חדשה" })).toBeVisible();
    await expect(page.getByLabel("שם המטלה")).toHaveValue("");
    await expect(page.getByRole("group", { name: "תלמידים" })).toBeVisible();
    await expect(page.getByLabel("תאריך הגשה")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("תאריך הגשה")).toHaveValue("");
    await expect(editor(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "ביטול" })).toBeVisible();
    await expect(page.getByRole("link", { name: "חזרה לרשימת המטלות" })).toBeVisible();
    await expect(page.locator("header")).toContainText(DEMO_SEED.name);
  });

  test("focuses the title field", async ({ page }) => {
    await openPage(page, NEW_URL);

    await expect(page.getByLabel("שם המטלה")).toBeFocused();
  });

  test("the cancel link and the back link go to the assignments list", async ({ page }) => {
    await openPage(page, NEW_URL);

    await page.getByRole("link", { name: "ביטול" }).click();
    await expect(page).toHaveURL(LIST_URL);

    await gotoHydrated(page, NEW_URL);
    await page.getByRole("link", { name: "חזרה לרשימת המטלות" }).click();
    await expect(page).toHaveURL(LIST_URL);
  });

  test("a due date can be picked", async ({ page }) => {
    await openPage(page, NEW_URL);

    await page.getByLabel("תאריך הגשה").fill("2026-11-20");

    await expect(page.getByLabel("תאריך הגשה")).toHaveValue("2026-11-20");
  });

  test("without a session it goes to the sign-in page", async ({ page }) => {
    await page.goto(NEW_URL);

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("rich text editor", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, NEW_URL);
  });

  test("starts empty, with the toolbar buttons labelled in Hebrew", async ({ page }) => {
    await expect(editor(page)).toHaveText("");
    await expect(hiddenHtml(page)).toHaveValue("");
    for (const name of ["מודגש", "נטוי", "כותרת", "רשימת תבליטים", "רשימה ממוספרת", "ביטול פעולה", "חזרה על פעולה"]) {
      await expect(button(page, name)).toBeVisible();
    }
  });

  test("the toolbar buttons do not submit the form", async ({ page }) => {
    await expect(toolbar(page).locator("button:not([type=button])")).toHaveCount(0);
    await format(page, "מודגש");

    await expect(page).toHaveURL(NEW_URL);
  });

  test("text typed in the editor is kept as HTML for the form", async ({ page }) => {
    await editor(page).click();
    await page.keyboard.type("שלום כיתה");

    await expect(editor(page)).toHaveText("שלום כיתה");
    await expect(hiddenHtml(page)).toHaveValue("<p>שלום כיתה</p>");
  });

  test("the text is right-to-left", async ({ page }) => {
    await expect(editor(page)).toHaveCSS("direction", "rtl");
  });

  test("clicking the label focuses the editor", async ({ page }) => {
    await page.getByText("תיאור המטלה", { exact: true }).click();

    await expect(editor(page)).toBeFocused();
  });

  test("bold: the button turns it on and off, and shows when it is on", async ({ page }) => {
    await editor(page).click();

    await format(page, "מודגש");
    await expect(button(page, "מודגש")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.type("חשוב");
    await format(page, "מודגש");
    await expect(button(page, "מודגש")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.type(" רגיל");

    await expect(editor(page).locator("strong")).toHaveText("חשוב");
    await expect(hiddenHtml(page)).toHaveValue("<p><strong>חשוב</strong> רגיל</p>");
  });

  test("italic and the keyboard shortcut for bold", async ({ page }) => {
    await editor(page).click();

    await format(page, "נטוי");
    await page.keyboard.type("נטוי");
    await format(page, "נטוי");
    await page.keyboard.press("Control+b");
    await page.keyboard.type("מודגש");

    await expect(editor(page).locator("em")).toHaveText("נטוי");
    await expect(editor(page).locator("strong")).toHaveText("מודגש");
  });

  test("heading", async ({ page }) => {
    await editor(page).click();

    await format(page, "כותרת");
    await page.keyboard.type("הנחיות");

    await expect(button(page, "כותרת")).toHaveAttribute("aria-pressed", "true");
    await expect(editor(page).locator("h2")).toHaveText("הנחיות");
    await expect(hiddenHtml(page)).toHaveValue("<h2>הנחיות</h2>");
  });

  test("a bullet list, and Enter adds the next item", async ({ page }) => {
    await editor(page).click();

    await format(page, "רשימת תבליטים");
    await page.keyboard.type("אחד");
    await page.keyboard.press("Enter");
    await page.keyboard.type("שניים");

    await expect(editor(page).locator("ul > li")).toHaveText(["אחד", "שניים"]);
    await expect(hiddenHtml(page)).toHaveValue("<ul><li><p>אחד</p></li><li><p>שניים</p></li></ul>");
  });

  test("a numbered list", async ({ page }) => {
    await editor(page).click();

    await format(page, "רשימה ממוספרת");
    await page.keyboard.type("ראשון");
    await page.keyboard.press("Enter");
    await page.keyboard.type("שני");

    await expect(editor(page).locator("ol > li")).toHaveText(["ראשון", "שני"]);
  });

  test("lists and headings look like lists and headings (bullets, numbers, bigger text)", async ({ page }) => {
    await editor(page).click();
    await format(page, "רשימת תבליטים");
    await page.keyboard.type("פריט");
    await expect(editor(page).locator("ul")).toHaveCSS("list-style-type", "disc");

    await format(page, "רשימת תבליטים");
    await format(page, "רשימה ממוספרת");
    await expect(editor(page).locator("ol")).toHaveCSS("list-style-type", "decimal");

    await format(page, "רשימה ממוספרת");
    await format(page, "כותרת");
    const headingSize = await editor(page).locator("h2").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const bodySize = await editor(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(headingSize).toBeGreaterThan(bodySize);
  });

  // A heading or a list that is the last block must still have a line below it to click into. Without one the caret
  // stays in the heading or the list, and the next button changes the text above (the header became list item 1,
  // and what was typed went into the header). The empty line below is only for typing: it is not saved.
  const clickBelowTheText = async (page: Page): Promise<void> => {
    // A click by coordinates must be on screen.
    await editor(page).scrollIntoViewIfNeeded();
    const box = await editor(page).boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 10);
  };

  test.describe("a heading or a list that is the last block", () => {
    for (const [name, tag, expectedAfter] of [
      ["רשימה ממוספרת", "ol", "<h2>הנחיות</h2><ol><li><p>סעיף</p></li></ol>"],
      ["רשימת תבליטים", "ul", "<h2>הנחיות</h2><ul><li><p>סעיף</p></li></ul>"],
      ["כותרת", "h2", "<h2>הנחיות</h2><h2>סעיף</h2>"],
    ] as const) {
      test(`${name} after a click below a heading starts new text below, and the heading stays`, async ({ page }) => {
        await editor(page).click();
        await format(page, "כותרת");
        await page.keyboard.type("הנחיות");

        await clickBelowTheText(page);
        await format(page, name);
        await page.keyboard.type("סעיף");

        await expect(hiddenHtml(page)).toHaveValue(expectedAfter);
        await expect(editor(page).locator("h2").first()).toHaveText("הנחיות");
        await expect(editor(page).locator(tag).last()).toContainText("סעיף");
      });
    }

    test("a heading after a click below a list goes below the list, and the list keeps its items", async ({ page }) => {
      await editor(page).click();
      await format(page, "רשימה ממוספרת");
      await page.keyboard.type("אחד");
      await page.keyboard.press("Enter");
      await page.keyboard.type("שניים");

      await clickBelowTheText(page);
      await format(page, "כותרת");
      await page.keyboard.type("סיכום");

      await expect(hiddenHtml(page)).toHaveValue("<ol><li><p>אחד</p></li><li><p>שניים</p></li></ol><h2>סיכום</h2>");
    });

    test("plain text can be typed below a list with a click, without pressing Enter twice", async ({ page }) => {
      await editor(page).click();
      await format(page, "רשימת תבליטים");
      await page.keyboard.type("פריט");

      await clickBelowTheText(page);
      await page.keyboard.type("טקסט רגיל");

      await expect(hiddenHtml(page)).toHaveValue("<ul><li><p>פריט</p></li></ul><p>טקסט רגיל</p>");
    });

    test("the empty line below is not saved: a heading, or a list, at the end is sent without it", async ({ page }) => {
      await editor(page).click();
      await format(page, "כותרת");
      await page.keyboard.type("הנחיות");
      await expect(editor(page).locator("> *")).toHaveCount(2);
      await expect(hiddenHtml(page)).toHaveValue("<h2>הנחיות</h2>");

      await page.keyboard.press("Enter");
      await format(page, "רשימת תבליטים");
      await page.keyboard.type("פריט");
      await expect(hiddenHtml(page)).toHaveValue("<h2>הנחיות</h2><ul><li><p>פריט</p></li></ul>");
    });

    test("a blank line between two blocks is kept", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("א");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("ב");

      await expect(hiddenHtml(page)).toHaveValue("<p>א</p><p></p><p>ב</p>");
    });

    test("an editor with only a heading in it that is deleted is empty again", async ({ page }) => {
      await editor(page).click();
      await format(page, "כותרת");
      await page.keyboard.type("א");
      await page.keyboard.press("Backspace");

      await expect(hiddenHtml(page)).toHaveValue("");
    });
  });

  // Regular text as the last block: a click below it is a click on the empty area, not on the text. The caret must go
  // to a new line there, or a list or heading button changes the text itself, and what is typed next goes into it
  // (the text became the first list item and "א" was added to it).
  test.describe("a click below the last line, when it is regular text", () => {
    for (const [name, expected] of [
      ["רשימת תבליטים", "<p>טקסט</p><ul><li><p>א</p></li></ul>"],
      ["רשימה ממוספרת", "<p>טקסט</p><ol><li><p>א</p></li></ol>"],
      ["כותרת", "<p>טקסט</p><h2>א</h2>"],
    ] as const) {
      test(`${name} starts new text below the text, and the text stays as it was`, async ({ page }) => {
        await editor(page).click();
        await page.keyboard.type("טקסט");

        await clickBelowTheText(page);
        await format(page, name);
        await page.keyboard.type("א");

        await expect(hiddenHtml(page)).toHaveValue(expected);
      });
    }

    test("typing starts a new paragraph below the text", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("טקסט");

      await clickBelowTheText(page);
      await page.keyboard.type("שורה חדשה");

      await expect(hiddenHtml(page)).toHaveValue("<p>טקסט</p><p>שורה חדשה</p>");
    });

    test("a mix of regular text, a heading and lists, each started with a click below the last line", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("יש לענות על השאלות:");
      await clickBelowTheText(page);
      await format(page, "רשימה ממוספרת");
      await page.keyboard.type("שאלה ראשונה");
      await page.keyboard.press("Enter");
      await page.keyboard.type("שאלה שנייה");
      await clickBelowTheText(page);
      await format(page, "כותרת");
      await page.keyboard.type("בהצלחה");
      await clickBelowTheText(page);
      await page.keyboard.type("סוף");
      await clickBelowTheText(page);
      await format(page, "רשימת תבליטים");
      await page.keyboard.type("נקודה אחרונה");

      await expect(hiddenHtml(page)).toHaveValue(
        "<p>יש לענות על השאלות:</p><ol><li><p>שאלה ראשונה</p></li><li><p>שאלה שנייה</p></li></ol><h2>בהצלחה</h2><p>סוף</p><ul><li><p>נקודה אחרונה</p></li></ul>",
      );
    });
    test("the new empty line is not saved, and clicking below again does not add another", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("טקסט");

      await clickBelowTheText(page);
      await clickBelowTheText(page);
      await clickBelowTheText(page);

      await expect(editor(page).locator("> *")).toHaveCount(2);
      await expect(hiddenHtml(page)).toHaveValue("<p>טקסט</p>");
    });

    test("in an empty editor it adds nothing", async ({ page }) => {
      await clickBelowTheText(page);

      await expect(editor(page).locator("> *")).toHaveCount(1);
      await expect(hiddenHtml(page)).toHaveValue("");
    });

    test("a click on the text itself still changes that line, as before", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("טקסט");

      await editor(page).locator("p").first().click();
      await format(page, "רשימת תבליטים");

      await expect(hiddenHtml(page)).toHaveValue("<ul><li><p>טקסט</p></li></ul>");
    });

    test("selecting text by dragging down into the empty area adds nothing", async ({ page }) => {
      await editor(page).click();
      await page.keyboard.type("שורה ראשונה");
      await page.keyboard.press("Enter");
      await page.keyboard.type("שורה שנייה");
      const first = (await editor(page).locator("p").first().boundingBox())!;
      const last = (await editor(page).locator("p").last().boundingBox())!;
      const area = (await editor(page).boundingBox())!;

      await page.mouse.move(first.x + first.width - 5, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(last.x + 30, area.y + area.height - 8, { steps: 6 });
      await page.mouse.up();

      await expect(editor(page).locator("> *")).toHaveCount(2);
      await expect(hiddenHtml(page)).toHaveValue("<p>שורה ראשונה</p><p>שורה שנייה</p>");
    });
  });

  test("emptying the editor leaves an empty value, not an empty paragraph", async ({ page }) => {
    await editor(page).click();
    await page.keyboard.type("מחק");
    await expect(hiddenHtml(page)).toHaveValue("<p>מחק</p>");

    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");

    await expect(hiddenHtml(page)).toHaveValue("");
  });

  test("pasted content is reduced to what the toolbar offers: no links, quotes or scripts", async ({ page }) => {
    await editor(page).click();

    await editor(page).evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<blockquote><a href="https://example.com">קישור</a></blockquote><script>window.hacked=1</script><p onclick="window.hacked=1">פסקה</p>',
      );
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });

    await expect(editor(page)).toContainText("פסקה");
    await expect(editor(page).locator("a, blockquote, script")).toHaveCount(0);
    expect(await hiddenHtml(page).inputValue()).not.toMatch(/<a |<blockquote|<script|onclick/);
    expect(await page.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined();
  });
});

test.describe("assignment form: the edit page", () => {
  test("is filled with the assignment from the database", async ({ page }) => {
    const sample: TTeacherAssignment = await openEdit(page);

    await expect(page.getByRole("heading", { name: "עריכת מטלה" })).toBeVisible();
    await expect(page.getByLabel("שם המטלה")).toHaveValue(sample.title);
    await expect(page.getByLabel("תאריך הגשה")).toHaveValue(sample.dueDate);
    for (const { name } of sample.students) {
      await expect(page.getByRole("checkbox", { name, exact: true })).toBeChecked();
    }
    await expect(page.getByRole("button", { name: "שמירה", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "הוספה", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "חזרה לרשימת המטלות" })).toBeVisible();
  });

  test("an assignment that does not exist shows the not-found page", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);

    await page.goto("/dashboard/assignments/0198f0a2-7b3c-7d4e-8f5a-1b2c3d4e5f60/edit");

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
    await expect(page.getByLabel("שם המטלה")).toHaveCount(0);
  });

  test("an assignment of another teacher shows the same not-found page, with no form", async ({ page }) => {
    await signInAs(page.request, OTHER_SEED);
    const [theirs] = await getAssignmentsWithStudents(page.request);
    await signInAs(page.request, DEMO_SEED);

    await page.goto(editUrlOf(theirs));

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
    await expect(page.getByLabel("שם המטלה")).toHaveCount(0);
    await expect(page.getByText(theirs.title)).toHaveCount(0);
  });

  test("an id that is not a uuid shows the same not-found page", async ({ page }) => {
    await signInAs(page.request, DEMO_SEED);

    await page.goto("/dashboard/assignments/not-a-uuid/edit");

    await expect(page.getByRole("heading", { name: "המטלה לא נמצאה" })).toBeVisible();
  });

  test("shows the description with its formatting in the editor", async ({ page }) => {
    await openEdit(page);

    await expect(editor(page).locator("h2")).toHaveText("הנחיות");
    await expect(editor(page).locator("strong")).toHaveText("עבודה");
    await expect(editor(page).locator("em")).toHaveText("המהפכה התעשייתית");
    await expect(editor(page).locator("ul > li")).toHaveCount(2);
    expect(await hiddenHtml(page).inputValue()).toContain("<h2>הנחיות</h2>");
  });

  test("the toolbar shows the formatting at the cursor", async ({ page }) => {
    await openEdit(page);

    await editor(page).locator("strong").click();
    await expect(button(page, "מודגש")).toHaveAttribute("aria-pressed", "true");

    await editor(page).locator("h2").click();
    await expect(button(page, "כותרת")).toHaveAttribute("aria-pressed", "true");
    await expect(button(page, "מודגש")).toHaveAttribute("aria-pressed", "false");

    await editor(page).locator("li").first().click();
    await expect(button(page, "רשימת תבליטים")).toHaveAttribute("aria-pressed", "true");
  });

  test("the existing text can be edited, and the form value follows", async ({ page }) => {
    await openEdit(page);

    await editor(page).locator("li").last().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" ולתת דוגמה");

    await expect(editor(page).locator("li").last()).toContainText("ולתת דוגמה");
    expect(await hiddenHtml(page).inputValue()).toContain("ולתת דוגמה");
  });

  test("without a session it goes to the sign-in page", async ({ page }) => {
    const assignment: TTeacherAssignment = await loadEdited(page);
    await page.context().clearCookies();

    await page.goto(editUrlOf(assignment));

    await expect(page).toHaveURL(/\/auth$/);
  });
});

test.describe("assignment form: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("fits the screen, with the whole toolbar, and the editor can be used", async ({ page }) => {
    await openPage(page, NEW_URL);

    const width: number = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    for (const name of ["מודגש", "נטוי", "כותרת", "רשימת תבליטים", "רשימה ממוספרת", "ביטול פעולה", "חזרה על פעולה"]) {
      await expect(button(page, name)).toBeVisible();
    }

    await editor(page).click();
    await page.keyboard.type("בדיקה");
    await expect(hiddenHtml(page)).toHaveValue("<p>בדיקה</p>");
  });
});
