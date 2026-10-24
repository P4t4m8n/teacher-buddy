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
      await client.query(
        `delete from "Student"
         where "teacherId" in (select id from "Teacher" where name = $1)
           and not (name = any($2::text[]))`,
        [seed.name, seededStudentNames(seed)],
      );
    }
  } finally {
    await client.end();
  }
};

// The dev server compiles each page the first time it is requested. Without this, the first tests
// of a run all wait for that compile at the same moment and time out. A real browser is used so the
// scripts of the pages are compiled too. It creates no data.
const warmUpServer = async (baseURL: string): Promise<void> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/auth");
    await page.request.post("/api/auth/login", { data: DEMO_TEACHER });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "הוספת תלמיד" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    for (const path of ["/api/auth/me", "/api/students", "/api/classes", "/api/auth/session-expired"]) {
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
