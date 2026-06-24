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
 * `<RouteRegionsSection />` — shared chrome wrapper used by EVERY surface
 * that needs to show 「途經區域」: the public detail page, the admin upload
 * preview, and the admin edit page. It owns the `<section>` + `<h2>` so
 * the heading style cannot drift between surfaces.
 *
 * Two call shapes:
 *   1. `<RouteRegionsSection regions={...} />` — convenience for surfaces
 *      that just want the heading + the paragraph body. Returns `null`
 *      when `regions.length === 0` so the calling page renders nothing
 *      (matches the existing public detail page behaviour).
 *   2. `<RouteRegionsSection>{custom body}</RouteRegionsSection>` — slot
 *      form for surfaces that need to render a non-paragraph body
 *      (e.g. the admin upload page's loading skeleton, ready-empty hint,
 *      or error alert). The heading always renders in this form.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       openspec/changes/refactor-upload-metadata-fields/specs/route-administrative-regions/spec.md
 */

import type { ReactNode } from "react";

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

type RouteRegionsSectionProps =
  | { regions: Region[]; children?: undefined }
  | { regions?: undefined; children: ReactNode };

export function RouteRegionsSection(props: RouteRegionsSectionProps) {
  // Convenience form: caller passed regions only. Hide entirely when empty
  // so the public detail page doesn't render a dangling heading.
  if ("regions" in props && props.regions !== undefined) {
    if (props.regions.length === 0) return null;
    return (
      <section aria-labelledby="regions-heading" className="space-y-2">
        <h2
          id="regions-heading"
          className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
        >
          途經區域
        </h2>
        <RouteRegions regions={props.regions} />
      </section>
    );
  }
  // Slot form: heading + caller-provided body (loading skeleton / hint /
  // alert / etc.). Heading always renders so admin surfaces can show
  // surface-specific empty / error copy under the same chrome.
  return (
    <section aria-labelledby="regions-heading" className="space-y-2">
      <h2
        id="regions-heading"
        className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
      >
        途經區域
      </h2>
      {props.children}
    </section>
  );
}
