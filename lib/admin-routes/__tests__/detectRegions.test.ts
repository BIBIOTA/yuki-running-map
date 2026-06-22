import { describe, expect, it, vi } from "vitest";

import { detectRegions } from "../detectRegions";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "detectRegions performs the spatial query helper"
 *
 * The helper is a thin SQL wrapper. We unit-test the SQL shape that gets
 * sent to the transaction (via a captured spy on tx.execute) so the spec
 * Scenarios are exercised without a live PostGIS. The DB-side correctness
 * of ST_Intersects is implicitly covered by 0006/0007 (the GIST index is
 * registered) and explicitly by the verification stage's manual smoke.
 */
describe("detectRegions", () => {
  it("issues ST_Intersects(admin_units.geom, ST_GeomFromGeoJSON(...)) and returns the result ids", async () => {
    const execute = vi.fn().mockResolvedValue([
      { id: "11111111-1111-1111-1111-111111111111" },
      { id: "22222222-2222-2222-2222-222222222222" },
    ]);
    const tx = { execute };

    const geojson = {
      type: "LineString" as const,
      coordinates: [
        [121.515, 25.04],
        [121.535, 25.04],
      ],
    };

    const result = await detectRegions(tx, geojson);

    expect(result).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    const query = execute.mock.calls[0]?.[0];
    expect(query).toBeDefined();
    // Drizzle's sql template tag yields a SQL object; serialise via a small
    // adapter to get the text + the inlined values.
    const queryString = String(query);
    expect(queryString).toMatch(/ST_Intersects/i);
    expect(queryString).toMatch(/admin_units/i);
    expect(queryString).toMatch(/ST_GeomFromGeoJSON/i);
  });

  it("returns [] when the spatial query yields zero rows (offshore line)", async () => {
    const tx = { execute: vi.fn().mockResolvedValue([]) };
    const result = await detectRegions(tx, {
      type: "LineString",
      coordinates: [
        [124.0, 24.0],
        [125.0, 24.0],
      ],
    });
    expect(result).toEqual([]);
  });

  it("propagates the underlying error so the outer transaction can roll back", async () => {
    const boom = new Error("invalid geometry");
    const tx = { execute: vi.fn().mockRejectedValue(boom) };
    await expect(
      detectRegions(tx, {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).rejects.toBe(boom);
  });
});
