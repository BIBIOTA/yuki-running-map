import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/design.md §3.1 row 0004
 *       openspec/changes/feat-gpx-driven-route-metadata/tasks.md task 1.1
 *
 * Why a content assertion (rather than running the migration against a live DB):
 * the project's vitest config runs in `node` environment without a Supabase
 * connection by default. The `*.integration.test.ts` suites do connect, but
 * Drizzle's migrate runner applies the entire journal (not just one file),
 * which means asserting "after 0004 the routes table has no difficulty" is
 * conflated with whatever 0005+ later add. A content assertion on the SQL is
 * therefore the smallest possible Red — it pins down the contract of the
 * migration file itself (DROP COLUMN difficulty + DROP COLUMN duration_s +
 * DROP TYPE difficulty) while integration coverage of post-migration state
 * lives in the schema.test.ts + integration suites that are updated alongside.
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0004_drop_route_difficulty_and_duration.sql",
);

describe("migration 0004 · drop routes.difficulty + routes.duration_s", () => {
  it("Migration file exists at the expected path", () => {
    expect(() => readFileSync(MIGRATION_PATH, "utf-8")).not.toThrow();
  });

  it("SQL drops the difficulty column", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/ALTER TABLE\s+"?routes"?\s+DROP COLUMN[^;]*"?difficulty"?/i);
  });

  it("SQL drops the duration_s column", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/ALTER TABLE\s+"?routes"?\s+DROP COLUMN[^;]*"?duration_s"?/i);
  });

  it("SQL drops the difficulty enum type", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/DROP TYPE[^;]*"?difficulty"?/i);
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "lib/db/migrations/meta/_journal.json"), "utf-8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const tags = journal.entries.map((e) => e.tag);
    expect(tags).toContain("0004_drop_route_difficulty_and_duration");
  });
});
