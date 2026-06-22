import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "0008 backfills route_admin_units and drops legacy region column"
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0008_drop_routes_region_add_backfill.sql",
);

describe("migration 0008 · backfill route_admin_units + DROP routes.region", () => {
  it("Migration file exists", () => {
    expect(() => readFileSync(MIGRATION_PATH, "utf-8")).not.toThrow();
  });

  it("Backfills route_admin_units via ST_Intersects + NOT EXISTS guard", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/INSERT INTO\s+"?route_admin_units"?/i);
    expect(sql).toMatch(/ST_Intersects/i);
    expect(sql).toMatch(/NOT EXISTS/i);
  });

  it("DROPs the routes.region column", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/ALTER TABLE\s+"?routes"?\s+DROP COLUMN[^;]*"?region"?/i);
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "lib/db/migrations/meta/_journal.json"), "utf-8"),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((e) => e.tag)).toContain(
      "0008_drop_routes_region_add_backfill",
    );
  });
});
