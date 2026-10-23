import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The e2e suite must never run against the real database: the app under test
// gets DATABASE_URL_TEST in place of DATABASE_URL.
config({ quiet: true });
const testDatabaseUrl: string | undefined = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) {
  throw new Error("DATABASE_URL_TEST is required to run the e2e tests (set it in .env).");
}
process.env.DATABASE_URL = testDatabaseUrl;

const PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Own port and never reuse a running server, so the tests always use the test DB.
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    // Fixed so the cookie assertions do not depend on the developer's .env.
    env: { COOKIE_SECURE: "false" },
  },
});
