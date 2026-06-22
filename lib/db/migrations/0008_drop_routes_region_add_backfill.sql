-- Backfill route_admin_units for existing routes + drop legacy
-- routes.region column.
--
-- The backfill scans every routes row, runs ST_Intersects against
-- admin_units, and INSERTs the resulting join rows. `NOT EXISTS`
-- filters out routes that already have join entries (so this migration
-- is idempotent: re-running it after a partial failure does not double
-- insert). Routes whose simplified geojson does not intersect any
-- admin_unit (offshore / cross-border) end up with zero join rows —
-- design.md §6.3 documents this as permitted state.
--
-- Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
--       Requirement "0008 backfills route_admin_units and drops legacy region column"

INSERT INTO "route_admin_units" ("route_id", "admin_unit_id")
SELECT r.id, a.id
  FROM "routes" r
  JOIN "admin_units" a
    ON ST_Intersects(
         a.geom,
         ST_SetSRID(ST_GeomFromGeoJSON(r.geojson->>'geometry'), 4326)
       )
 WHERE NOT EXISTS (
   SELECT 1
     FROM "route_admin_units" rau
    WHERE rau.route_id = r.id
 );--> statement-breakpoint

ALTER TABLE "routes" DROP COLUMN "region";
