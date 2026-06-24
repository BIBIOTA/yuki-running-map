import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       Requirement "0009 migration drops routes.tags and its GIN index"
 *
 * Scenario:
 *   "Migration drops index then column"
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0009_drop_routes_tags.sql",
);

describe("migration 0009 · drop routes.tags + routes_tags_gin", () => {
  it("Migration drops index then column", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    // DROP INDEX must appear before DROP COLUMN to avoid PG dependency
    // warnings — see openspec/changes/refactor-upload-metadata-fields/design.md §7.
    const dropIndexIdx = sql.search(/DROP INDEX\s+IF EXISTS\s+"?routes_tags_gin"?/i);
    const dropColumnIdx = sql.search(
      /ALTER TABLE\s+"?routes"?\s+DROP COLUMN[^;]*"?tags"?/i,
    );
    expect(dropIndexIdx).toBeGreaterThanOrEqual(0);
    expect(dropColumnIdx).toBeGreaterThanOrEqual(0);
    expect(dropIndexIdx).toBeLessThan(dropColumnIdx);
  });

  it("Migration body contains no other DDL", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    // Strip comments + blank lines, then split by `;` to count statements.
    const statements = sql
      .replace(/--[^\n]*/g, "")
      .split(/;\s*(?:--> statement-breakpoint)?/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(/DROP INDEX/i);
    expect(statements[1]).toMatch(/ALTER TABLE/i);
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(
        join(process.cwd(), "lib/db/migrations/meta/_journal.json"),
        "utf-8",
      ),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((e) => e.tag)).toContain("0009_drop_routes_tags");
  });
});
