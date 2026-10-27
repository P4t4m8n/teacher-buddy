import { config } from "dotenv";
import { chromium, type FullConfig } from "@playwright/test";
import { Client } from "pg";
import { DEMO_TEACHER } from "../constants/demo.constant";
import { WRITE_OTHER_SEED, WRITE_SEED, type TSeedTeacher } from "../prisma/seed-data";


const WRITE_TEACHERS: TSeedTeacher[] = [WRITE_SEED, WRITE_OTHER_SEED];

const seededStudentNames = (seed: TSeedTeacher): string[] =>
  seed.classes.flatMap(({ students }) => students.map(({ name }) => name));

const resetWriteTeachers = async (): Promise<void> => {
  const url: string | undefined = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is required to run the e2e tests (set it in .env).");

  // This deletes rows, so it refuses to run against anything that is not clearly a test database.
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error("DATABASE_URL_TEST must point to a database whose name contains 'test'.");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const seed of WRITE_TEACHERS) {
      // The assignments of the write teachers go too (with their students' parts and files), so tests
      // that create assignments leave nothing behind.
      await client.query(`delete from "Assignment" where "teacherId" in (select id from "Teacher" where name = $1)`, [
        seed.name,
      ]);
      await client.query(
        `delete from "Student"
         where "teacherId" in (select id from "Teacher" where name = $1)
           and not (name = any($2::text[]))`,
        [seed.name, seededStudentNames(seed)],
      );
    }
    // Teachers made by a test file for itself (createBulkTeacher), left behind by a run that stopped before it cleaned up.
    await client.query(`delete from "Teacher" where name like 'מורה לדפדוף %'`);
  } finally {
    await client.end();
  }
};

// The dev server compiles each page the first time it is requested.
const warmUpServer = async (baseURL: string): Promise<void> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/auth");
    await page.request.post("/api/auth/login", { data: DEMO_TEACHER });
    await page.goto("/dashboard");
    // Opens a delete confirmation, so the scripts of the modal are compiled too.
    await page.getByRole("button", { name: /^מחיקה עבור/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    const detailsHref = await page.getByRole("link", { name: /^פרטים עבור/ }).first().getAttribute("href");
    const editHref = await page.getByRole("link", { name: /^עריכה עבור/ }).first().getAttribute("href");
    // The pages of the first assignment (a real one, so they are the pages that tests open, not "not found").
    const assignments: { id: string }[] = (await (await page.request.get("/api/assignments")).json()).assignments ?? [];
    const assignmentPages: string[] = assignments.slice(0, 1).flatMap(({ id }) => [
      `/dashboard/assignments/${id}`,
      `/dashboard/assignments/${id}/edit`,
    ]);
    for (const path of [
      "/dashboard/students/new",
      "/dashboard/assignments",
      "/dashboard/assignments/new",
      ...assignmentPages,
      detailsHref,
      editHref,
    ]) {
      if (path) await page.goto(path);
    }
    for (const path of ["/api/auth/me", "/api/students", "/api/classes", "/api/assignments", "/api/auth/session-expired"]) {
      await page.request.get(path, { maxRedirects: 0 });
    }
    await page.request.post("/api/auth/logout");
  } finally {
    await browser.close();
  }
};

export default async function globalSetup(fullConfig: FullConfig): Promise<void> {
  config({ quiet: true });
  await resetWriteTeachers();

  const baseURL: string | undefined = fullConfig.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("baseURL is required to warm up the server.");
  await warmUpServer(baseURL);
}
