import { expect, test, type Locator, type Page } from "@playwright/test";
import { getSampleTeacherAssignments, SAMPLE_STUDENT_ASSIGNMENTS } from "../constants/assignment.constant";
import { DEMO_SEED, OTHER_SEED } from "../prisma/seed-data";
import { getStudentList, gotoHydrated, signInAs } from "./helpers";

// The pages only show a form for now (nothing is saved yet), so the demo teacher is safe to use.
const NEW_URL = "/dashboard/assignments/new";
const EDIT_URL = `/dashboard/assignments/${SAMPLE_STUDENT_ASSIGNMENTS[0].id}/edit`;

// The classes that have students, in the order the list shows them: by name, in Hebrew.
const GROUPS = DEMO_SEED.classes
  .filter(({ students }) => students.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name, "he"));
const [FIRST_GROUP, SECOND_GROUP] = GROUPS;

const openPage = async (page: Page, url: string = NEW_URL): Promise<void> => {
  await signInAs(page.request, DEMO_SEED);
  await gotoHydrated(page, url);
  await expect(page.getByRole("toolbar")).toBeVisible();
};

const list = (page: Page): Locator => page.getByRole("group", { name: "תלמידים", exact: true });
const classGroup = (page: Page, className: string): Locator => page.getByRole("group", { name: `כיתה ${className}`, exact: true });
const classToggle = (page: Page, className: string): Locator => page.getByRole("checkbox", { name: `בחירת כל כיתה ${className}`, exact: true });
const student = (page: Page, name: string): Locator => page.getByRole("checkbox", { name, exact: true });
const counter = (page: Page): Locator => list(page).locator("p[aria-live]");

const isIndeterminate = (checkbox: Locator): Promise<boolean> =>
  checkbox.evaluate((element: HTMLInputElement) => element.indeterminate);

const submittedIds = (page: Page): Promise<string[]> =>
  page.locator("form").evaluate((form: HTMLFormElement) => new FormData(form).getAll("studentIds").map(String));

test.describe("students multi-select: what it shows", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test("has a group for every class that has students, in order, with all of its students", async ({ page }) => {
    await expect(page.getByRole("group", { name: /^כיתה / })).toHaveCount(GROUPS.length);

    for (const group of GROUPS) {
      await expect(classGroup(page, group.name)).toBeVisible();
      for (const { name } of group.students) await expect(classGroup(page, group.name).getByRole("checkbox", { name, exact: true })).toBeVisible();
    }
    const headings: string[] = await page.getByRole("checkbox", { name: /^בחירת כל כיתה/ }).evaluateAll((boxes) =>
      boxes.map((box) => (box as HTMLInputElement).getAttribute("aria-label") ?? ""),
    );
    expect(headings).toEqual(GROUPS.map(({ name }) => `בחירת כל כיתה ${name}`));
  });

  test("a class with no students is not listed", async ({ page }) => {
    for (const { name } of DEMO_SEED.classes.filter(({ students }) => students.length === 0)) {
      await expect(classGroup(page, name)).toHaveCount(0);
    }
  });

  test("shows nobody else's students", async ({ page }) => {
    for (const { students } of OTHER_SEED.classes) {
      for (const { name } of students) await expect(student(page, name)).toHaveCount(0);
    }
  });

  test("starts with nothing chosen", async ({ page }) => {
    await expect(page.locator('input[name="studentIds"]:checked')).toHaveCount(0);
    await expect(counter(page)).toHaveText("לא נבחרו תלמידים");
    await expect(classGroup(page, FIRST_GROUP.name)).toContainText(`(0/${FIRST_GROUP.students.length})`);
    expect(await submittedIds(page)).toEqual([]);
  });

  test("is a scrollable list, with the class names staying on top while scrolling", async ({ page }) => {
    const box = list(page).locator("> div").first();

    const sizes = await box.evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    await expect(box).toHaveCSS("overflow-y", "auto");

    // Scrolled a little into the first class, its name stays pinned at the top of the list.
    const header = classToggle(page, FIRST_GROUP.name).locator("xpath=ancestor::label");
    await expect(header).toHaveCSS("position", "sticky");
    await box.evaluate((element) => element.scrollTo(0, 60));
    const pinned = await header.boundingBox();
    const frame = await box.boundingBox();
    expect(Math.abs(pinned!.y - frame!.y)).toBeLessThan(4);
  });
});

test.describe("students multi-select: choosing", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test("choosing a student checks it, and the counter and the class count follow", async ({ page }) => {
    const [one, two] = FIRST_GROUP.students;

    await student(page, one.name).check();
    await expect(student(page, one.name)).toBeChecked();
    await expect(counter(page)).toHaveText("נבחר תלמיד אחד");
    await expect(classGroup(page, FIRST_GROUP.name)).toContainText(`(1/${FIRST_GROUP.students.length})`);

    await student(page, two.name).check();
    await expect(counter(page)).toHaveText("נבחרו 2 תלמידים");

    await student(page, one.name).uncheck();
    await expect(counter(page)).toHaveText("נבחר תלמיד אחד");
    await student(page, two.name).uncheck();
    await expect(counter(page)).toHaveText("לא נבחרו תלמידים");
  });

  test("clicking the name of a student chooses it", async ({ page }) => {
    const { name } = FIRST_GROUP.students[0];

    await classGroup(page, FIRST_GROUP.name).getByText(name, { exact: true }).click();

    await expect(student(page, name)).toBeChecked();
  });

  test("the keyboard chooses with the space bar", async ({ page }) => {
    const { name } = FIRST_GROUP.students[0];
    await student(page, name).focus();

    await page.keyboard.press("Space");

    await expect(student(page, name)).toBeChecked();
    await page.keyboard.press("Space");
    await expect(student(page, name)).not.toBeChecked();
  });

  test("students of different classes can be chosen together", async ({ page }) => {
    await student(page, FIRST_GROUP.students[0].name).check();
    await student(page, SECOND_GROUP.students[0].name).check();

    await expect(counter(page)).toHaveText("נבחרו 2 תלמידים");
    await expect(classGroup(page, FIRST_GROUP.name)).toContainText(`(1/${FIRST_GROUP.students.length})`);
    await expect(classGroup(page, SECOND_GROUP.name)).toContainText(`(1/${SECOND_GROUP.students.length})`);
  });

  test("the form sends the ids of the chosen students, and only them", async ({ page }) => {
    const students = await getStudentList(page.request);
    const idOf = (name: string): string => students.find((candidate) => candidate.name === name)!.id;
    const chosen = [FIRST_GROUP.students[0].name, SECOND_GROUP.students[0].name];

    for (const name of chosen) await student(page, name).check();

    expect((await submittedIds(page)).sort()).toEqual(chosen.map(idOf).sort());

    await student(page, chosen[0]).uncheck();
    expect(await submittedIds(page)).toEqual([idOf(chosen[1])]);
  });

  test("the checkbox of a class is only a shortcut: it is not sent with the form", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();

    const names: string[] = await page.locator("form").evaluate((form: HTMLFormElement) =>
      [...new FormData(form).keys()],
    );
    expect(names.filter((key) => key !== "description" && key !== "studentIds")).not.toContain("on");
    expect((await submittedIds(page)).length).toBe(FIRST_GROUP.students.length);
  });
});

test.describe("students multi-select: whole classes", () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test("the class checkbox chooses every student of the class, and only that class", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();

    for (const { name } of FIRST_GROUP.students) await expect(student(page, name)).toBeChecked();
    for (const { name } of SECOND_GROUP.students) await expect(student(page, name)).not.toBeChecked();
    await expect(counter(page)).toHaveText(
      FIRST_GROUP.students.length === 1 ? "נבחר תלמיד אחד" : `נבחרו ${FIRST_GROUP.students.length} תלמידים`,
    );
    await expect(classGroup(page, FIRST_GROUP.name)).toContainText(
      `(${FIRST_GROUP.students.length}/${FIRST_GROUP.students.length})`,
    );
  });

  test("checking it again clears the class", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();

    await classToggle(page, FIRST_GROUP.name).uncheck();

    for (const { name } of FIRST_GROUP.students) await expect(student(page, name)).not.toBeChecked();
    await expect(counter(page)).toHaveText("לא נבחרו תלמידים");
  });

  test("a class with only some students chosen shows a mixed mark, and the checkbox completes it", async ({
    page,
  }) => {
    await student(page, FIRST_GROUP.students[0].name).check();
    expect(await isIndeterminate(classToggle(page, FIRST_GROUP.name))).toBe(true);
    await expect(classToggle(page, FIRST_GROUP.name)).not.toBeChecked();

    await classToggle(page, FIRST_GROUP.name).click();

    for (const { name } of FIRST_GROUP.students) await expect(student(page, name)).toBeChecked();
    expect(await isIndeterminate(classToggle(page, FIRST_GROUP.name))).toBe(false);
    await expect(classToggle(page, FIRST_GROUP.name)).toBeChecked();
  });

  test("choosing the last student of a class checks the class checkbox", async ({ page }) => {
    for (const { name } of FIRST_GROUP.students) await student(page, name).check();

    await expect(classToggle(page, FIRST_GROUP.name)).toBeChecked();
    expect(await isIndeterminate(classToggle(page, FIRST_GROUP.name))).toBe(false);
  });

  test("clearing a student from a full class makes it mixed again", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();

    await student(page, FIRST_GROUP.students[0].name).uncheck();

    expect(await isIndeterminate(classToggle(page, FIRST_GROUP.name))).toBe(true);
  });

  test("a class that is not touched shows no mark", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();

    await expect(classToggle(page, SECOND_GROUP.name)).not.toBeChecked();
    expect(await isIndeterminate(classToggle(page, SECOND_GROUP.name))).toBe(false);
  });

  test("two classes can be chosen whole", async ({ page }) => {
    await classToggle(page, FIRST_GROUP.name).check();
    await classToggle(page, SECOND_GROUP.name).check();

    expect((await submittedIds(page)).length).toBe(FIRST_GROUP.students.length + SECOND_GROUP.students.length);
  });
});

test.describe("students multi-select: on the edit page", () => {
  test("starts with the students of the assignment chosen, and the counts to match", async ({ page }) => {
    await openPage(page, EDIT_URL);
    const sample = getSampleTeacherAssignments(await getStudentList(page.request))[0];

    for (const { name } of sample.students) await expect(student(page, name)).toBeChecked();
    await expect(page.locator('input[name="studentIds"]:checked')).toHaveCount(sample.students.length);
    await expect(counter(page)).toHaveText(`נבחרו ${sample.students.length} תלמידים`);
    expect((await submittedIds(page)).sort()).toEqual(sample.students.map(({ studentId }) => studentId).sort());
  });

  test("a student can be removed and another added", async ({ page }) => {
    await openPage(page, EDIT_URL);
    const sample = getSampleTeacherAssignments(await getStudentList(page.request))[0];
    const outside = DEMO_SEED.classes.flatMap(({ students }) => students).find(
      ({ name }) => !sample.students.some((assigned) => assigned.name === name),
    )!;

    await student(page, sample.students[0].name).uncheck();
    await student(page, outside.name).check();

    await expect(counter(page)).toHaveText(`נבחרו ${sample.students.length} תלמידים`);
    expect(await submittedIds(page)).not.toContain(sample.students[0].studentId);
  });
});

test.describe("students multi-select: narrow screen", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("fits the screen, and a class can be chosen", async ({ page }) => {
    await openPage(page);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await classToggle(page, FIRST_GROUP.name).check();

    await expect(student(page, FIRST_GROUP.students[0].name)).toBeChecked();
  });
});
