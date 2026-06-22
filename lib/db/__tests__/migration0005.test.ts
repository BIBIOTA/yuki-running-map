import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-elevation-profile/spec.md
 *       ADDED Requirement: "routes.elevation_profile jsonb column stores the per-route profile"
 *       Scenario: "Migration adds column with default empty array"
 *
 * Same rationale as the 0004 sibling: content-assert the SQL file rather
 * than running the migration against a live DB so the test stays in the
 * node-environment vitest run without a Supabase connection.
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0005_add_elevation_profile.sql",
);

describe("migration 0005 · add routes.elevation_profile jsonb column", () => {
  it("Migration file exists at the expected path", () => {
    expect(() => readFileSync(MIGRATION_PATH, "utf-8")).not.toThrow();
  });

  it("SQL adds the elevation_profile column as NOT NULL jsonb with default '[]'", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    // Matches ADD COLUMN "elevation_profile" jsonb DEFAULT '[]'::jsonb NOT NULL
    // (Drizzle emits the modifiers in either order — accept both.)
    expect(sql).toMatch(/ALTER TABLE\s+"?routes"?\s+ADD COLUMN[^;]*"?elevation_profile"?[^;]*jsonb/i);
    expect(sql).toMatch(/elevation_profile[^;]*NOT NULL/i);
    expect(sql).toMatch(/elevation_profile[^;]*DEFAULT\s+'\[\]'::jsonb/i);
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "lib/db/migrations/meta/_journal.json"), "utf-8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const tags = journal.entries.map((e) => e.tag);
    expect(tags).toContain("0005_add_elevation_profile");
  });
});
