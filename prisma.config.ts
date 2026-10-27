import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct or session connection (a transaction pooler breaks them), so DIRECT_URL wins when it is set.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
