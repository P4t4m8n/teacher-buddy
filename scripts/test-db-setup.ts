import "dotenv/config";
import { spawnSync } from "node:child_process";

const testDatabaseUrl: string | undefined = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) {
  throw new Error("DATABASE_URL_TEST is required (set it in .env).");
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST must not point to the real database.");
}

// dotenv never overrides existing variables, so prisma.config.ts and the seed
// pick up the test URL from the environment of these child processes.
const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };

function run(command: string): void {
  const result = spawnSync(command, { env, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// --reset wipes the test database first, so it always matches the current seed data.
if (process.argv.includes("--reset")) {
  run("npx prisma migrate reset --force");
}

run("npx prisma migrate deploy");
run("npx prisma db seed");
