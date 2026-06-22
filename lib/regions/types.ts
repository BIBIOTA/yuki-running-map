/**
 * Public `Region` type shared by RouteRegions, RouteMetadataForm,
 * RouteList, and the public detail page.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "RouteRegions renders per-county text paragraphs across surfaces"
 *
 * Mirrors the `admin_units` table shape but stays narrow — view components
 * never touch the geometry column, so it is not part of the structural
 * contract. `parent_code` is the unidirectional link from townships to
 * their county (county rows have `parent_code = null`).
 */
export interface Region {
  code: string;
  level: "county" | "township";
  name: string;
  parent_code?: string | null;
}
