import { describe, expect, it } from "vitest";

import { groupRegionsByCounty, toInlineSummary } from "../routeRegionsView";

/**
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "RouteRegions renders per-county text paragraphs across surfaces"
 *
 * Pure view-model logic lives here. The JSX component (RouteRegions.tsx)
 * stays a thin wrapper around these helpers.
 */
describe("groupRegionsByCounty (stacked variant)", () => {
  it("returns an empty array for empty input", () => {
    expect(groupRegionsByCounty([])).toEqual([]);
  });

  it("groups townships under their county", () => {
    const groups = groupRegionsByCounty([
      { code: "63000", level: "county", name: "台北市" },
      { code: "63000010", level: "township", name: "中正區", parent_code: "63000" },
      { code: "63000020", level: "township", name: "大安區", parent_code: "63000" },
      { code: "65000", level: "county", name: "新北市" },
      { code: "65000010", level: "township", name: "三重區", parent_code: "65000" },
    ]);
    expect(groups).toEqual([
      {
        countyName: "台北市",
        countyCode: "63000",
        townshipNames: ["中正區", "大安區"],
      },
      {
        countyName: "新北市",
        countyCode: "65000",
        townshipNames: ["三重區"],
      },
    ]);
  });

  it("preserves orphan townships (no matching county) as a synthetic group", () => {
    // Defensive: an admin_units refresh could in principle leave a township
    // pointing at a now-deleted county. Render the township name anyway so
    // the chip / paragraph never silently swallows data.
    const groups = groupRegionsByCounty([
      { code: "63000010", level: "township", name: "中正區", parent_code: "63000" },
    ]);
    expect(groups).toEqual([
      {
        countyName: "63000",
        countyCode: "63000",
        townshipNames: ["中正區"],
      },
    ]);
  });
});

describe("toInlineSummary (inline variant for admin list)", () => {
  it("returns '—' for empty input", () => {
    expect(toInlineSummary([])).toBe("—");
  });

  it("composes single-line '{縣市} {鄉鎮…} / {縣市} {鄉鎮…}' across counties", () => {
    expect(
      toInlineSummary([
        { code: "63000", level: "county", name: "台北市" },
        { code: "63000010", level: "township", name: "中正區", parent_code: "63000" },
        { code: "63000020", level: "township", name: "大安區", parent_code: "63000" },
        { code: "65000", level: "county", name: "新北市" },
        { code: "65000010", level: "township", name: "三重區", parent_code: "65000" },
      ]),
    ).toBe("台北市 中正區、大安區 / 新北市 三重區");
  });

  it("renders a county-only group as just the county name", () => {
    expect(
      toInlineSummary([{ code: "63000", level: "county", name: "台北市" }]),
    ).toBe("台北市");
  });
});
