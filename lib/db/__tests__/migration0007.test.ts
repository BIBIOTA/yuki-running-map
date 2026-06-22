import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "seed migration imports Taiwan admin units from GeoJSON"
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "lib/db/migrations/0007_seed_taiwan_admin_units.sql",
);
const SEED_GEOJSON_PATH = join(
  process.cwd(),
  "lib/db/migrations/seed/taiwan-admin-units.geojson",
);

describe("migration 0007 · seed taiwan admin units", () => {
  it("Migration file exists", () => {
    expect(() => readFileSync(MIGRATION_PATH, "utf-8")).not.toThrow();
  });

  it("SQL inserts into admin_units with ST_MakeValid + ST_GeomFromGeoJSON", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/INSERT INTO\s+"?admin_units"?/i);
    expect(sql).toMatch(/ST_MakeValid/i);
    expect(sql).toMatch(/ST_GeomFromGeoJSON/i);
  });

  it("SQL references seed GeoJSON literal that contains expected counties", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    // The seed values are inlined per Drizzle's SQL-only migration constraint
    // (no \copy from a path that won't exist in production). Confirm core
    // identifiers land in the SQL body.
    expect(sql).toMatch(/63000/); // 台北市 county code
    expect(sql).toMatch(/65000/); // 新北市 county code
    expect(sql).toMatch(/county/);
    expect(sql).toMatch(/township/);
  });

  it("Seed GeoJSON has at least one county and one township", () => {
    const geojson = JSON.parse(readFileSync(SEED_GEOJSON_PATH, "utf-8")) as {
      type: string;
      features: Array<{ properties: { code: string; level: string; name: string } }>;
    };
    expect(geojson.type).toBe("FeatureCollection");
    const counties = geojson.features.filter((f) => f.properties.level === "county");
    const townships = geojson.features.filter((f) => f.properties.level === "township");
    expect(counties.length).toBeGreaterThanOrEqual(1);
    expect(townships.length).toBeGreaterThanOrEqual(1);
    // Every township parent_code exists as a county code.
    const countyCodes = new Set(counties.map((c) => c.properties.code));
    for (const t of townships) {
      const parent = (t.properties as { parent_code?: string | null }).parent_code;
      expect(parent, `township ${t.properties.code} parent_code`).toBeTruthy();
      expect(countyCodes.has(parent!)).toBe(true);
    }
  });

  it("Migration is registered in the journal", () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), "lib/db/migrations/meta/_journal.json"), "utf-8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries.map((e) => e.tag)).toContain(
      "0007_seed_taiwan_admin_units",
    );
  });
});
