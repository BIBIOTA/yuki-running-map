import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseGpx } from "../parse";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../__fixtures__/sample.gpx");
const expectedPath = path.resolve(here, "../__fixtures__/sample.expected.json");
const noEleFixturePath = path.resolve(here, "../__fixtures__/no-elevation.gpx");

interface SampleExpected {
  trackPointCount: number;
  distanceM: number;
  elevationGainM: number;
  bbox: [number, number, number, number];
  startPoint: [number, number];
  recordedAt: string;
}

const fixtureBuffer = readFileSync(fixturePath);
const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as SampleExpected;

describe("parseGpx", () => {
  it("parseGpx returns the expected metadata for a fixture", () => {
    const result = parseGpx(fixtureBuffer);

    // distance within ±5 m of the independently computed expected total
    expect(result.distanceM).toBeGreaterThan(expected.distanceM - 5);
    expect(result.distanceM).toBeLessThan(expected.distanceM + 5);

    // bbox SW + NE corners match
    expect(result.bbox[0]).toBeCloseTo(expected.bbox[0], 6); // minLng
    expect(result.bbox[1]).toBeCloseTo(expected.bbox[1], 6); // minLat
    expect(result.bbox[2]).toBeCloseTo(expected.bbox[2], 6); // maxLng
    expect(result.bbox[3]).toBeCloseTo(expected.bbox[3], 6); // maxLat

    // start point matches first trackpoint, recordedAt matches first <time>
    expect(result.startPoint[0]).toBeCloseTo(expected.startPoint[0], 6);
    expect(result.startPoint[1]).toBeCloseTo(expected.startPoint[1], 6);
    expect(result.recordedAt.toISOString()).toBe(expected.recordedAt);

    // elevation gain is computed from positive deltas over the full set
    expect(result.elevationGainM).toBeCloseTo(expected.elevationGainM, 1);

    // returned geojson is a LineString Feature in [lng, lat] order
    expect(result.geojson.type).toBe("Feature");
    expect(result.geojson.geometry.type).toBe("LineString");
    const coords = result.geojson.geometry.coordinates;
    expect(coords.length).toBeGreaterThanOrEqual(100);
    expect(coords.length).toBeLessThanOrEqual(500);
    expect(coords[0]).toEqual([expected.startPoint[0], expected.startPoint[1]]);
  });

  it("throws when the GPX contains no trackpoints", () => {
    const empty = Buffer.from(
      '<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>',
    );
    expect(() => parseGpx(empty)).toThrow(/no valid trackpoints/);
  });

  it("ignores trackpoints with invalid coordinates", () => {
    const gpx = Buffer.from(
      `<?xml version="1.0"?>
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg>
          <trkpt lat="999" lon="0"><ele>10</ele><time>2026-01-01T00:00:00Z</time></trkpt>
          <trkpt lat="25.0" lon="121.5"><ele>10</ele><time>2026-01-01T00:00:01Z</time></trkpt>
          <trkpt lat="25.001" lon="121.501"><ele>12</ele><time>2026-01-01T00:00:02Z</time></trkpt>
        </trkseg></trk>
      </gpx>`,
    );
    const result = parseGpx(gpx);
    expect(result.startPoint).toEqual([121.5, 25.0]);
    expect(result.elevationGainM).toBeCloseTo(2, 5);
  });

  it("handles multi-segment tracks and missing elevation/time", () => {
    const gpx = Buffer.from(
      `<?xml version="1.0"?>
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <trk>
          <trkseg>
            <trkpt lat="25.0" lon="121.5"/>
            <trkpt lat="25.001" lon="121.5"/>
          </trkseg>
          <trkseg>
            <trkpt lat="25.002" lon="121.5"/>
          </trkseg>
        </trk>
      </gpx>`,
    );
    const result = parseGpx(gpx);
    expect(result.elevationGainM).toBe(0);
    expect(result.distanceM).toBeGreaterThan(200); // ~222m north-south
    expect(result.recordedAt.getTime()).toBe(0); // epoch fallback when no <time>
    expect(result.bbox).toEqual([121.5, 25.0, 121.5, 25.002]);
  });

  /**
   * route-elevation-profile capability:
   * ADDED Requirement "parseGpx computes elevation_profile from trackpoints"
   */
  describe("Scenario: GPX with continuous elevation data", () => {
    it("returns elevationProfile as [distance_m, elevation_m] pairs", () => {
      const result = parseGpx(fixtureBuffer);

      expect(result.elevationProfile.length).toBeGreaterThanOrEqual(2);
      expect(result.elevationProfile.length).toBeLessThanOrEqual(300);
      // First pair starts at distance 0.
      expect(result.elevationProfile[0]?.[0]).toBe(0);
      // Distance monotonically non-decreasing.
      for (let i = 1; i < result.elevationProfile.length; i++) {
        const prev = result.elevationProfile[i - 1]?.[0] ?? 0;
        const curr = result.elevationProfile[i]?.[0] ?? 0;
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });

  describe("Scenario: GPX without any <ele> tags", () => {
    it("returns elevationProfile = [] and elevationGainM = 0", () => {
      const noEleBuffer = readFileSync(noEleFixturePath);
      const result = parseGpx(noEleBuffer);
      expect(result.elevationProfile).toEqual([]);
      expect(result.elevationGainM).toBe(0);
    });
  });

  describe("Scenario: GPX with sparse <ele> tags", () => {
    it("includes entries only at points with <ele>; distance reflects every trackpoint", () => {
      const gpx = Buffer.from(
        `<?xml version="1.0"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk><trkseg>
            <trkpt lat="25.0" lon="121.5"><ele>10</ele></trkpt>
            <trkpt lat="25.001" lon="121.5"/>
            <trkpt lat="25.002" lon="121.5"><ele>14</ele></trkpt>
            <trkpt lat="25.003" lon="121.5"/>
            <trkpt lat="25.004" lon="121.5"><ele>10</ele></trkpt>
          </trkseg></trk>
        </gpx>`,
      );
      const result = parseGpx(gpx);
      expect(result.elevationProfile.length).toBeGreaterThanOrEqual(2);
      // Profile entries only at trackpoints that carry <ele>.
      // First three with-elevation points at distances 0 / ~222 / ~444 m.
      const distances = result.elevationProfile.map((p) => p[0]);
      expect(distances[0]).toBe(0);
      // Last with-elevation point sits at ~444m cumulative — not the
      // total walking distance to the last point.
      const last = distances[distances.length - 1] ?? 0;
      expect(last).toBeGreaterThan(400);
      expect(last).toBeLessThan(500);
    });
  });
});
