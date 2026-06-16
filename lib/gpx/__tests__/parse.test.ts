import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseGpx } from "../parse";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../__fixtures__/sample.gpx");
const expectedPath = path.resolve(here, "../__fixtures__/sample.expected.json");

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
});
