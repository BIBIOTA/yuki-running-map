import type { LngLat } from "../types";

import { describe, expect, it } from "vitest";

import { ramerDouglasPeucker, simplifyLineString } from "../simplify";

/**
 * Build a synthetic polyline of `n` points along a sinusoidal path. Mirrors
 * the spec's "more than 1000 input coordinates" Scenario without needing to
 * touch the GPX fixture from the parse tests.
 */
function buildLine(n: number): LngLat[] {
  const coords: LngLat[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lng = 121.5 + t * 0.1 + Math.sin(t * Math.PI * 8) * 0.0005;
    const lat = 25.0 + Math.sin(t * Math.PI * 4) * 0.001;
    coords.push([lng, lat]);
  }
  return coords;
}

describe("simplifyLineString", () => {
  it("simplifyLineString preserves endpoints", () => {
    const coords = buildLine(1500);
    const out = simplifyLineString(coords, 0.0001);

    expect(out.length).toBeGreaterThanOrEqual(100);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out[0]).toEqual(coords[0]);
    expect(out[out.length - 1]).toEqual(coords[coords.length - 1]);
  });

  it("returns inputs of length ≤ 2 unchanged", () => {
    expect(simplifyLineString([])).toEqual([]);
    const single: LngLat[] = [[121.5, 25.0]];
    expect(simplifyLineString(single)).toEqual(single);
    const pair: LngLat[] = [
      [121.5, 25.0],
      [121.6, 25.1],
    ];
    expect(simplifyLineString(pair)).toEqual(pair);
  });

  it("returns rdp output as-is when input is smaller than 100 points", () => {
    // 50 collinear-ish points — RDP will keep just the endpoints.
    const coords: LngLat[] = Array.from({ length: 50 }, (_, i) => [
      121.5 + i * 0.001,
      25.0 + i * 0.001,
    ]);
    const out = simplifyLineString(coords, 0.0001);
    expect(out.length).toBeLessThanOrEqual(coords.length);
    expect(out[0]).toEqual(coords[0]);
    expect(out[out.length - 1]).toEqual(coords[coords.length - 1]);
  });

  it("handles a degenerate segment (two identical points in a row)", () => {
    const coords: LngLat[] = [
      [121.5, 25.0],
      [121.5, 25.0], // identical to previous
      [121.6, 25.1],
    ];
    const out = simplifyLineString(coords, 0.0001);
    expect(out[0]).toEqual(coords[0]);
    expect(out[out.length - 1]).toEqual(coords[coords.length - 1]);
  });
});

/**
 * Generic `ramerDouglasPeucker<T>` — task 2.2 extracts a reusable RDP
 * primitive parameterised by a `distanceFn(point, lineStart, lineEnd)`.
 * `simplifyLineString` (lng/lat) becomes a thin wrapper. The new caller
 * in task 2.3 will pass a `(distanceM, elevationM)` tuple + a matching
 * perpendicular-distance function.
 */
describe("ramerDouglasPeucker (generic)", () => {
  /** Standard perpendicular-to-line distance in arbitrary 2D units. */
  function planarDistance(
    p: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number],
  ): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const num = Math.abs(dx * (a[1] - p[1]) - (a[0] - p[0]) * dy);
    return num / Math.hypot(dx, dy);
  }

  it("collapses 3 collinear points to 2", () => {
    const out = ramerDouglasPeucker(
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
      planarDistance,
      0.1,
    );
    expect(out).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it("preserves a sharp corner point above tolerance", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [1, 10], // sharp spike
      [2, 0],
    ];
    const out = ramerDouglasPeucker(pts, planarDistance, 0.5);
    expect(out).toEqual(pts);
  });

  it("returns inputs of length ≤ 2 idempotent", () => {
    expect(ramerDouglasPeucker([], planarDistance, 0.1)).toEqual([]);
    expect(
      ramerDouglasPeucker([[1, 2]], planarDistance, 0.1),
    ).toEqual([[1, 2]]);
    const pair: Array<[number, number]> = [
      [0, 0],
      [5, 5],
    ];
    expect(ramerDouglasPeucker(pair, planarDistance, 0.1)).toEqual(pair);
  });

  it("works on a non-LngLat tuple type (distance-elevation pair)", () => {
    // distance (cumulative metres) increases monotonically; elevation in metres.
    const profile: Array<[number, number]> = [
      [0, 100],
      [100, 100], // collinear with start + end at tol 0.1
      [200, 100],
    ];
    const out = ramerDouglasPeucker(profile, planarDistance, 1);
    expect(out).toEqual([
      [0, 100],
      [200, 100],
    ]);
  });
});
