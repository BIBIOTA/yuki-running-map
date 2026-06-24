/**
 * Unit tests for the refresh-admin-units pipeline.
 *
 * Spec: openspec/changes/refresh-taiwan-admin-units/specs/route-administrative-regions/spec.md
 *       Requirement "refresh-admin-units convenience wrapper script"
 *
 * Scenarios covered:
 *   - Successful refresh writes the normalised seed
 *   - g0v fetch failure exits 1 with diagnostic message
 *   - g0v response is not valid JSON
 *   - Unexpected county count emits a non-fatal warning
 *
 * The CLI entry point in scripts/refresh-admin-units.ts is a thin wrapper
 * around `refreshAdminUnits(deps)`. The helper takes its IO dependencies
 * (fetch, writeFile, stdout, stderr, processExit) explicitly so node-only
 * vitest can exercise every branch without touching the network or the
 * filesystem.
 */

import { describe, expect, it, vi } from "vitest";

import { refreshAdminUnits } from "../refreshAdminUnits";

const COUNTY_URL =
  "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json";
const TOWN_URL =
  "https://raw.githubusercontent.com/g0v/twgeojson/master/json/twTown1982.geo.json";

function makeCountyFeature(sn: string, name: string) {
  return {
    type: "Feature",
    properties: { COUNTYSN: sn, COUNTYNAME: name },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [121, 25],
          [122, 25],
          [122, 26],
          [121, 26],
          [121, 25],
        ],
      ],
    },
  };
}

function makeTownFeature(sn: string, name: string, countySn: string) {
  return {
    type: "Feature",
    properties: { TOWNSN: sn, TOWNNAME: name, COUNTYSN: countySn },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [121.5, 25],
          [121.6, 25],
          [121.6, 25.1],
          [121.5, 25.1],
          [121.5, 25],
        ],
      ],
    },
  };
}

function makeCountyCollection(features: unknown[]) {
  return { type: "FeatureCollection", features };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("refreshAdminUnits", () => {
  it("Successful refresh writes the normalised seed", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const stdout = vi.fn();
    const stderr = vi.fn();
    const processExit = vi.fn();

    const counties = makeCountyCollection([
      makeCountyFeature("10001", "縣 A"),
      makeCountyFeature("10002", "縣 B"),
    ]);
    const towns = makeCountyCollection([
      makeTownFeature("1000101", "區 A1", "10001"),
      makeTownFeature("1000201", "區 B1", "10002"),
    ]);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === COUNTY_URL) return jsonResponse(counties);
      if (url === TOWN_URL) return jsonResponse(towns);
      throw new Error(`unexpected url: ${url}`);
    });

    await refreshAdminUnits({
      fetchImpl,
      writeFile,
      stdout,
      stderr,
      processExit,
      seedPath: "/tmp/seed-test.geojson",
    });

    expect(fetchImpl).toHaveBeenCalledWith(COUNTY_URL);
    expect(fetchImpl).toHaveBeenCalledWith(TOWN_URL);
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [seedPath, body] = writeFile.mock.calls[0]!;
    expect(seedPath).toBe("/tmp/seed-test.geojson");
    const parsed = JSON.parse(body as string);
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.features).toHaveLength(4);
    expect(parsed.features[0].properties).toEqual({
      code: "10001",
      level: "county",
      name: "縣 A",
      parent_code: null,
    });
    expect(stdout).toHaveBeenCalledWith(
      "Wrote 4 features to /tmp/seed-test.geojson\n",
    );
    expect(processExit).not.toHaveBeenCalled();
  });

  it("g0v fetch failure exits 1 with diagnostic message", async () => {
    const stderr = vi.fn();
    const processExit = vi.fn();

    const fetchImpl = vi.fn(async (url: string) => {
      if (url === COUNTY_URL)
        return new Response("server boom", { status: 503 });
      throw new Error("should not reach town fetch");
    });

    await refreshAdminUnits({
      fetchImpl,
      writeFile: vi.fn(),
      stdout: vi.fn(),
      stderr,
      processExit,
      seedPath: "/tmp/unused.geojson",
    });

    expect(processExit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringMatching(
        /^failed to fetch https:\/\/raw\.githubusercontent\.com.+: HTTP 503/,
      ),
    );
  });

  it("g0v response is not valid JSON", async () => {
    const stderr = vi.fn();
    const processExit = vi.fn();

    const fetchImpl = vi.fn(async () =>
      new Response("<html>oops</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await refreshAdminUnits({
      fetchImpl,
      writeFile: vi.fn(),
      stdout: vi.fn(),
      stderr,
      processExit,
      seedPath: "/tmp/unused.geojson",
    });

    expect(processExit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringMatching(
        /^g0v response was not valid JSON; got first 200 chars: /,
      ),
    );
  });

  it("Unexpected county count emits a non-fatal warning", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const stdout = vi.fn();
    const stderr = vi.fn();
    const processExit = vi.fn();

    const counties = makeCountyCollection([
      makeCountyFeature("10001", "唯一一縣"),
    ]);
    const towns = makeCountyCollection([
      makeTownFeature("1000101", "區 A", "10001"),
    ]);
    const fetchImpl = vi.fn(async (url: string) =>
      jsonResponse(url === COUNTY_URL ? counties : towns),
    );

    await refreshAdminUnits({
      fetchImpl,
      writeFile,
      stdout,
      stderr,
      processExit,
      seedPath: "/tmp/seed-warn.geojson",
    });

    expect(stderr).toHaveBeenCalledWith("note: expected 22 counties, got 1\n");
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(processExit).not.toHaveBeenCalled();
  });
});
