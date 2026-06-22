-- Add routes.elevation_profile per
-- openspec/changes/feat-gpx-driven-route-metadata/design.md §3.1 row 0005.
--
-- jsonb DEFAULT '[]'::jsonb means existing rows back-fill to the empty array
-- (no per-row backfill script is run in this change — see design.md §10.1).
-- The detail page's `<ElevationProfile profile={[]} />` branch shows the
-- "此路線無海拔資料" empty-state for those pre-existing rows until they are
-- re-uploaded.
ALTER TABLE "routes" ADD COLUMN "elevation_profile" jsonb DEFAULT '[]'::jsonb NOT NULL;
