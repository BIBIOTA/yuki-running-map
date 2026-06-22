import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirements: "admin_units stores Taiwan county and township polygons"
 *                     "route_admin_units join table associates routes with admin_units"
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0006_add_admin_units.sql",
);

describe("migration 0006 · admin_units + route_admin_units tables", () => {
  it("Migration file exists", () => {
    expect(() => readFileSync(MIGRATION_PATH, "utf-8")).not.toThrow();
  });

  describe("admin_units table", () => {
    it("creates the admin_level enum with values county and township", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/CREATE TYPE\s+"?admin_level"?\s+AS ENUM\s*\(\s*'county'\s*,\s*'township'\s*\)/i);
    });

    it("creates the admin_units table with required columns", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/CREATE TABLE\s+"?admin_units"?/i);
      expect(sql).toMatch(/"?id"?\s+uuid/i);
      expect(sql).toMatch(/"?code"?\s+text\s+UNIQUE\s+NOT NULL/i);
      expect(sql).toMatch(/"?level"?\s+"?admin_level"?\s+NOT NULL/i);
      expect(sql).toMatch(/"?name"?\s+text\s+NOT NULL/i);
      expect(sql).toMatch(/"?parent_code"?\s+text/i);
      expect(sql).toMatch(/"?geom"?\s+geometry\s*\(\s*MultiPolygon\s*,\s*4326\s*\)\s+NOT NULL/i);
    });

    it("creates the GIST + level indexes", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/CREATE INDEX[^;]*admin_units_geom_gist[^;]*USING\s+GIST\s*\(\s*"?geom"?\s*\)/i);
      expect(sql).toMatch(/CREATE INDEX[^;]*admin_units_level_idx[^;]*"?level"?/i);
    });
  });

  describe("route_admin_units join table", () => {
    it("creates the table with composite PK and FK constraints", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/CREATE TABLE\s+"?route_admin_units"?/i);
      expect(sql).toMatch(/PRIMARY KEY\s*\(\s*"?route_id"?\s*,\s*"?admin_unit_id"?\s*\)/i);
      expect(sql).toMatch(/route_id[^,]*REFERENCES\s+"?routes"?[^,]*ON DELETE CASCADE/i);
      expect(sql).toMatch(/admin_unit_id[^,]*REFERENCES\s+"?admin_units"?[^,]*ON DELETE RESTRICT/i);
    });

    it("creates the admin_unit_id reverse-lookup index", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/CREATE INDEX[^;]*route_admin_units_admin_unit_idx[^;]*"?admin_unit_id"?/i);
    });
  });

  describe("RLS policies", () => {
    it("enables RLS on admin_units and grants anonymous SELECT", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/ALTER TABLE\s+"?admin_units"?\s+ENABLE ROW LEVEL SECURITY/i);
      // public anon SELECT
      expect(sql).toMatch(/POLICY[^;]*admin_units[^;]*FOR SELECT[^;]*USING\s*\(\s*true\s*\)/i);
    });

    it("enables RLS on route_admin_units and gates anonymous SELECT by routes.published", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf-8");
      expect(sql).toMatch(/ALTER TABLE\s+"?route_admin_units"?\s+ENABLE ROW LEVEL SECURITY/i);
      expect(sql).toMatch(/POLICY[^;]*route_admin_units[^;]*FOR SELECT/i);
      expect(sql).toMatch(/published\s*=\s*true/i);
    });
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "lib/db/migrations/meta/_journal.json"), "utf-8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const tags = journal.entries.map((e) => e.tag);
    expect(tags).toContain("0006_add_admin_units");
  });
});
