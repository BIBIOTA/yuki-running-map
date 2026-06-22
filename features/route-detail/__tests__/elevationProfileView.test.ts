import { describe, expect, it } from "vitest";

import { profileToSvg } from "../elevationProfileView";

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
});
