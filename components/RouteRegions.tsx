/**
 * `<RouteRegions />` — generic, server-renderable component shared by:
 *   - admin form (read-only display below the metadata fields)
 *   - public detail page (途經區域 section)
 *   - admin route list (inline truncated cell)
 *
 * Visual decision (see Figma frame 70:9 + commit chain):
 *   This is paragraph-style text, NOT chip / badge / pill UI. The county
 *   name is rendered with `font-medium text-primary` (Inter Medium +
 *   forest-green), townships with `text-foreground` (Inter Regular + ink),
 *   separated by " — ". Multiple counties stack vertically.
 *
 *   The "inline" variant collapses every county-and-township group onto a
 *   single line with CSS truncation, suitable for table cells. 0 regions
 *   render "—" for inline, or the component returns null entirely for
 *   stacked (so the caller hides the section heading too).
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "RouteRegions renders per-county text paragraphs across surfaces"
 */

import { groupRegionsByCounty, toInlineSummary } from "@/lib/regions/routeRegionsView";
import type { Region } from "@/lib/regions/types";

interface RouteRegionsProps {
  regions: Region[];
  variant?: "stacked" | "inline";
}

export function RouteRegions({ regions, variant = "stacked" }: RouteRegionsProps) {
  if (variant === "inline") {
    return (
      <span
        data-testid="route-regions-inline"
        className="block overflow-hidden text-ellipsis whitespace-nowrap"
      >
        {toInlineSummary(regions)}
      </span>
    );
  }

  if (regions.length === 0) {
    // Stacked: render nothing so the caller can also hide its surrounding
    // 「途經區域」 heading.
    return null;
  }

  const groups = groupRegionsByCounty(regions);
  return (
    <div data-testid="route-regions-stacked" className="space-y-1">
      {groups.map((group) => (
        <p key={group.countyCode} className="text-foreground">
          <span className="font-medium text-primary">{group.countyName}</span>
          {group.townshipNames.length > 0 ? (
            <>
              <span className="text-muted-foreground"> — </span>
              <span>{group.townshipNames.join("、")}</span>
            </>
          ) : null}
        </p>
      ))}
    </div>
  );
}
