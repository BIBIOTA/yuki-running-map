import { describe, expect, it } from "vitest";

import { niceElevationTicks, profileToSvg } from "../elevationProfileView";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-elevation-profile/spec.md
 *       ADDED Requirement "ElevationProfile renders SVG or empty hint"
 *       Scenario "Pure view logic is unit-testable"
 *
 * The view function lives separately from the React component so vitest can
 * cover it without the project growing a React testing library dep
 * (CLAUDE.md forbids that). The component (task 2.7) is a thin wrapper.
 */
describe("profileToSvg", () => {
  describe("Scenario: non-empty profile yields filled view model", () => {
    it("returns d / viewBox / xLabels / yLabels for a basic profile", () => {
      const result = profileToSvg([
        [0, 10],
        [100, 20],
        [200, 15],
      ]);
      if (result.kind === "empty") throw new Error("expected filled view");
      // d starts with an M command (may have padding for axis labels)
      expect(result.d.startsWith("M")).toBe(true);
      // viewBox is "0 0 W H" with positive dimensions
      expect(result.viewBox).toMatch(/^0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?$/);
      // xLabels include 0 and the last distance (200)
      const xValues = result.xLabels.map((l) => l.value);
      expect(xValues).toContain(0);
      expect(xValues).toContain(200);
      // yLabels include the min (10) and max (20) elevation
      const yValues = result.yLabels.map((l) => l.value);
      expect(yValues).toContain(10);
      expect(yValues).toContain(20);
    });

    it("handles a single-pair-after-start profile without throwing", () => {
      const result = profileToSvg([
        [0, 0],
        [100, 100],
      ]);
      expect(result.kind).toBe("filled");
    });
  });

  describe("Scenario: empty array yields { kind: 'empty' }", () => {
    it("returns the empty discriminant for []", () => {
      const result = profileToSvg([]);
      expect(result).toEqual({ kind: "empty" });
    });
  });

  describe("Scenario: d encodes the SVG path correctly", () => {
    it("emits N M/L commands for N points", () => {
      const profile: Array<[number, number]> = [
        [0, 10],
        [50, 20],
        [100, 30],
        [150, 40],
      ];
      const result = profileToSvg(profile);
      if (result.kind === "empty") throw new Error("expected filled view");
      // Exactly one M followed by (N - 1) L commands.
      const commandCount = (result.d.match(/[ML]/g) ?? []).length;
      expect(commandCount).toBe(profile.length);
    });
  });

  describe("Scenario: filled view exposes plot bounds for gridline rendering", () => {
    it("returns plotXStart < plotXEnd inside the SVG width", () => {
      const result = profileToSvg([
        [0, 0],
        [100, 50],
      ]);
      if (result.kind === "empty") throw new Error("expected filled view");
      expect(result.plotXStart).toBeGreaterThan(0);
      expect(result.plotXEnd).toBeGreaterThan(result.plotXStart);
      // Plot must sit inside the declared viewBox width.
      const [, , widthStr] = result.viewBox.split(" ");
      const width = Number(widthStr);
      expect(result.plotXEnd).toBeLessThan(width);
    });
  });

  describe("Scenario: yLabels align with horizontal gridlines on round elevations", () => {
    it("emits 4-6 ticks on round metre values for a typical hike-scale span", () => {
      // Span = 500m → step = 100m → ticks at 100, 200, 300, 400, 500.
      const result = profileToSvg([
        [0, 50],
        [5_000, 550],
      ]);
      if (result.kind === "empty") throw new Error("expected filled view");
      const values = result.yLabels.map((l) => l.value);
      expect(values).toEqual([100, 200, 300, 400, 500]);
      // Labels are formatted as integer metres.
      expect(result.yLabels.map((l) => l.text)).toEqual([
        "100m",
        "200m",
        "300m",
        "400m",
        "500m",
      ]);
    });

    it("y-positions strictly increase with descending elevation (SVG y inverts)", () => {
      const result = profileToSvg([
        [0, 0],
        [1_000, 400],
      ]);
      if (result.kind === "empty") throw new Error("expected filled view");
      // Labels emitted in ascending-value order; higher value → smaller SVG y.
      for (let i = 1; i < result.yLabels.length; i++) {
        const prev = result.yLabels[i - 1]!;
        const curr = result.yLabels[i]!;
        expect(curr.value).toBeGreaterThan(prev.value);
        expect(curr.position).toBeLessThan(prev.position);
      }
    });
  });
});

describe("niceElevationTicks", () => {
  it("snaps to multiples of 100 for a hike-scale span", () => {
    expect(niceElevationTicks(50, 550)).toEqual([100, 200, 300, 400, 500]);
  });

  it("snaps to multiples of 50 for a mid-range climb", () => {
    // Span = 180m → raw 45 → step 50.
    expect(niceElevationTicks(20, 200)).toEqual([50, 100, 150, 200]);
  });

  it("collapses to a single tick when min === max", () => {
    expect(niceElevationTicks(100, 100)).toEqual([100]);
  });

  it("keeps ticks within [min, max]", () => {
    const ticks = niceElevationTicks(123, 678);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(123);
      expect(t).toBeLessThanOrEqual(678);
    }
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });
});
