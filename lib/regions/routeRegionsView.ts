/**
 * Pure view helpers for `<RouteRegions>`.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "RouteRegions renders per-county text paragraphs across surfaces"
 *
 * Two output formats:
 *   - `groupRegionsByCounty`: stacks regions by county for the default
 *     `variant="stacked"` (admin form + public detail).
 *   - `toInlineSummary`: builds the single-line "{縣市} {鄉鎮…} / …" string
 *     for the admin list cell (`variant="inline"`).
 *
 * Orphan-township defence: an admin_units refresh could in principle leave
 * a township pointing at a now-deleted county. Both helpers fall back to
 * the township's `parent_code` as the synthetic county name so the row
 * keeps rendering rather than silently dropping data. The Figma-frame
 * happy path never hits this branch — it's purely defensive.
 */

import type { Region } from "./types";

export interface RegionGroup {
  countyName: string;
  countyCode: string;
  townshipNames: string[];
}

export function groupRegionsByCounty(
  regions: ReadonlyArray<Region>,
): RegionGroup[] {
  const groups = new Map<string, RegionGroup>();

  // First pass: register counties (so later township passes can attach).
  for (const region of regions) {
    if (region.level === "county") {
      groups.set(region.code, {
        countyName: region.name,
        countyCode: region.code,
        townshipNames: [],
      });
    }
  }

  // Second pass: attach townships, creating a synthetic group when the
  // parent county is absent.
  for (const region of regions) {
    if (region.level !== "township") continue;
    const parentCode = region.parent_code ?? region.code;
    let group = groups.get(parentCode);
    if (!group) {
      group = {
        countyName: parentCode,
        countyCode: parentCode,
        townshipNames: [],
      };
      groups.set(parentCode, group);
    }
    group.townshipNames.push(region.name);
  }

  return Array.from(groups.values());
}

export function toInlineSummary(regions: ReadonlyArray<Region>): string {
  if (regions.length === 0) return "—";
  return groupRegionsByCounty(regions)
    .map((g) => {
      if (g.townshipNames.length === 0) return g.countyName;
      return `${g.countyName} ${g.townshipNames.join("、")}`;
    })
    .join(" / ");
}
