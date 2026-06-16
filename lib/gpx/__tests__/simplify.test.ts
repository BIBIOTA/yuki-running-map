import type { LngLat } from "../types";

import { describe, expect, it } from "vitest";

import { simplifyLineString } from "../simplify";

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
