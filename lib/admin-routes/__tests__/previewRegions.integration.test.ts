/**
 * DB-gated integration test for `previewRegions`.
 *
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *       Requirement "previewRegions returns real regions after migration 0010"
 *
 * Scenario:
 *   - Real Taiwan GPX point resolves to county + township
 *
 * Gated via `describe.skipIf(!process.env.DATABASE_URL)` so contributors
 * without a local Supabase see the suite as skipped, not failed.
 *
 * Note: previewRegions uses `getDb()` (singleton) under the hood — we do
 * NOT mock it here because we want the real PostGIS query against the
 * migrated DB.
 */

import { describe, expect, it } from "vitest";

import { previewRegions } from "@/features/admin-routes/actions/previewRegions";

describe.skipIf(!process.env.DATABASE_URL)(
  "previewRegions (integration)",
  () => {
    it("previewRegions returns 新北市 + 瑞芳區 for the Afternoon_Run starting point", async () => {
      const result = await previewRegions({
        type: "LineString",
        coordinates: [
          [121.821940, 25.102832],
          [121.821967, 25.102839],
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const countyHit = result.regions.find(
        (r) => r.level === "county" && r.name === "新北市",
      );
      const townshipHit = result.regions.find(
        (r) => r.level === "township" && r.name === "瑞芳區",
      );
      expect(countyHit).toBeDefined();
      expect(townshipHit).toBeDefined();
    });
  },
);
