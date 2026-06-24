import { describe, expect, it } from "vitest";

import { normalizeAdminUnits } from "../normalizeAdminUnits";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       "seed migration imports Taiwan admin units from GeoJSON"
 *       Scenario "Seed migration loads counties and townships"
 *
 * Pure normalisation: input is the raw FeatureCollection (whatever shape the
 * source dataset uses), output is a FeatureCollection whose features carry
 * exactly `{ code, level, name, parent_code? }` properties and a MultiPolygon
 * geometry. The migration consumes the output verbatim; this test pins the
 * contract so the migration row insertion can rely on it.
 */
describe("normalizeAdminUnits", () => {
  describe("Scenario: input features get normalised property shape", () => {
    it("emits { code, level, name, parent_code } for each feature", () => {
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { COUNTYCODE: "63000", COUNTYNAME: "台北市" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [121.4, 25.0],
                  [121.7, 25.0],
                  [121.7, 25.2],
                  [121.4, 25.2],
                  [121.4, 25.0],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: {
              TOWNCODE: "63000010",
              TOWNNAME: "中正區",
              COUNTYCODE: "63000",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [121.50, 25.04],
                  [121.52, 25.04],
                  [121.52, 25.05],
                  [121.50, 25.05],
                  [121.50, 25.04],
                ],
              ],
            },
          },
        ],
      });
      expect(out.type).toBe("FeatureCollection");
      expect(out.features.length).toBe(2);

      const county = out.features[0]!;
      expect(county.properties).toEqual({
        code: "63000",
        level: "county",
        name: "台北市",
        parent_code: null,
      });
      expect(county.geometry.type).toBe("MultiPolygon");

      const township = out.features[1]!;
      expect(township.properties).toEqual({
        code: "63000010",
        level: "township",
        name: "中正區",
        parent_code: "63000",
      });
      expect(township.geometry.type).toBe("MultiPolygon");
    });
  });

  describe("Scenario: Polygon → MultiPolygon", () => {
    it("wraps Polygon coordinates into a single-element MultiPolygon", () => {
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { COUNTYCODE: "10001", COUNTYNAME: "Test" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      });
      const feature = out.features[0]!;
      expect(feature.geometry.type).toBe("MultiPolygon");
      // Wrapped Polygon coordinates become MultiPolygon[0]
      expect(feature.geometry.coordinates).toEqual([
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      ]);
    });

    it("preserves MultiPolygon input shape", () => {
      const mp = {
        type: "MultiPolygon" as const,
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
          [
            [
              [2, 2],
              [3, 2],
              [3, 3],
              [2, 2],
            ],
          ],
        ],
      };
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { COUNTYCODE: "10001", COUNTYNAME: "Multi" },
            geometry: mp,
          },
        ],
      });
      expect(out.features[0]!.geometry).toEqual(mp);
    });
  });

  describe("Scenario: invalid features are rejected", () => {
    it("throws when a county feature has no COUNTYCODE", () => {
      expect(() =>
        normalizeAdminUnits({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { COUNTYNAME: "missing code" },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        }),
      ).toThrow(/code/);
    });

    it("throws when a township feature has no parent COUNTYCODE", () => {
      expect(() =>
        normalizeAdminUnits({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { TOWNCODE: "63000010", TOWNNAME: "中正區" },
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        }),
      ).toThrow(/parent/i);
    });
  });

  /**
   * g0v fallback contract — refresh-taiwan-admin-units.
   *
   * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
   *       MODIFIED Requirement "normalizeAdminUnits maps raw 內政部 / g0v properties into the seed shape"
   *
   * g0v's twgeojson mirror ships counties as COUNTYSN (not COUNTYCODE) and
   * townships as TOWNSN (not TOWNCODE), with the parent county encoded in
   * COUNTYSN on the township feature. The normaliser accepts either source
   * so both 內政部 SHP-derived files and g0v's GeoJSON mirror work.
   */
  describe("g0v COUNTYSN / TOWNSN fallback", () => {
    it("County feature falls back to COUNTYSN when COUNTYCODE is absent", () => {
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { COUNTYSN: "10014001", COUNTYNAME: "台東縣" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [121.0, 22.5],
                  [121.5, 22.5],
                  [121.5, 23.0],
                  [121.0, 23.0],
                  [121.0, 22.5],
                ],
              ],
            },
          },
        ],
      });
      expect(out.features).toHaveLength(1);
      expect(out.features[0]!.properties).toEqual({
        code: "10014001",
        level: "county",
        name: "台東縣",
        parent_code: null,
      });
    });

    it("Township feature falls back to TOWNSN + COUNTYSN", () => {
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              TOWNSN: "10014001001",
              TOWNNAME: "瑞芳區",
              COUNTYSN: "10014001",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [121.8, 25.1],
                  [121.9, 25.1],
                  [121.9, 25.2],
                  [121.8, 25.2],
                  [121.8, 25.1],
                ],
              ],
            },
          },
        ],
      });
      expect(out.features).toHaveLength(1);
      expect(out.features[0]!.properties).toEqual({
        code: "10014001001",
        level: "township",
        name: "瑞芳區",
        parent_code: "10014001",
      });
    });

    it("Existing 內政部 COUNTYCODE / TOWNCODE inputs keep working", () => {
      const out = normalizeAdminUnits({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              TOWNCODE: "63000010",
              TOWNNAME: "中正區",
              COUNTYCODE: "63000",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [121.5, 25.04],
                  [121.52, 25.04],
                  [121.52, 25.05],
                  [121.5, 25.04],
                ],
              ],
            },
          },
        ],
      });
      expect(out.features[0]!.properties).toEqual({
        code: "63000010",
        level: "township",
        name: "中正區",
        parent_code: "63000",
      });
    });
  });
});
