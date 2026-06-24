import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *       Requirement "Migration 0010 replaces stub admin_units with real Taiwan boundaries"
 *
 * Scenarios:
 *   - Migration body order is TRUNCATE → INSERT admin_units → INSERT route_admin_units
 *   - Migration is registered in the journal
 *
 * The third scenario ("Migration truncates, re-seeds, and re-detects") is
 * a DB-side integration check verified by `pnpm db:migrate` + the manual
 * smoke in tasks 5.1 / 5.2 / 7.1 (no DATABASE_URL is required for these
 * static file checks).
 */
const ROOT = process.cwd();
const MIGRATION_PATH = join(
  ROOT,
  "lib/db/migrations/0010_refresh_taiwan_admin_units.sql",
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf-8");
}

describe("migration 0010 · refresh taiwan admin_units", () => {
  it("Migration file exists", () => {
    expect(statSync(MIGRATION_PATH).isFile()).toBe(true);
  });

  it("Migration body order is TRUNCATE → INSERT admin_units → INSERT route_admin_units", () => {
    const sql = readMigration();
    const truncateIdx = sql.search(/TRUNCATE\s+TABLE\s+"admin_units"\s+CASCADE/i);
    const insertAdminIdx = sql.search(
      /INSERT\s+INTO\s+"admin_units"[\s\S]*?ST_MakeValid\s*\(\s*ST_SetSRID\s*\(\s*ST_GeomFromGeoJSON/i,
    );
    const insertJoinIdx = sql.search(
      /INSERT\s+INTO\s+"route_admin_units"[\s\S]*?ST_Intersects/i,
    );

    expect(truncateIdx).toBeGreaterThanOrEqual(0);
    expect(insertAdminIdx).toBeGreaterThan(truncateIdx);
    expect(insertJoinIdx).toBeGreaterThan(insertAdminIdx);
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(
        join(ROOT, "lib/db/migrations/meta/_journal.json"),
        "utf-8",
      ),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find(
      (e) => e.tag === "0010_refresh_taiwan_admin_units",
    );
    expect(entry).toBeDefined();
    expect(entry!.idx).toBe(10);
    const ninth = journal.entries.find((e) => e.idx === 9);
    expect(entry!.when).toBeGreaterThan(ninth!.when);
  });
});
