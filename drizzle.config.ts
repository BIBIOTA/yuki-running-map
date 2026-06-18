import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL not set. Run pnpm scripts via --env-file=.env.local or export it before invoking drizzle-kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
