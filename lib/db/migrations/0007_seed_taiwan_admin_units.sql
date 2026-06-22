-- Seed admin_units from the normalised GeoJSON shipped in
-- lib/db/migrations/seed/taiwan-admin-units.geojson.
--
-- The migration runner reads SQL files verbatim, so the FeatureCollection
-- is inlined here as a jsonb literal. Refreshing the seed (year-on-year
-- 內政部 boundary changes per docs/runbooks/admin-units-refresh.md /
-- task 3.24) regenerates the GeoJSON via
-- `pnpm tsx scripts/build-admin-units-geojson.ts <input>` and then
-- writes a new migration that supersedes this one (TRUNCATE + re-INSERT).
--
-- `ST_MakeValid` is applied in case the normaliser ever produces a
-- self-intersecting polygon (boundary data with rounding artefacts);
-- valid input passes through untouched.

WITH seed_data AS (
  SELECT '{"type":"FeatureCollection","features":[
    {"type":"Feature","properties":{"code":"63000","level":"county","name":"台北市","parent_code":null},"geometry":{"type":"MultiPolygon","coordinates":[[[[121.45,24.96],[121.66,24.96],[121.66,25.21],[121.45,25.21],[121.45,24.96]]]]}},
    {"type":"Feature","properties":{"code":"63000010","level":"township","name":"中正區","parent_code":"63000"},"geometry":{"type":"MultiPolygon","coordinates":[[[[121.500,25.035],[121.525,25.035],[121.525,25.055],[121.500,25.055],[121.500,25.035]]]]}},
    {"type":"Feature","properties":{"code":"63000020","level":"township","name":"大安區","parent_code":"63000"},"geometry":{"type":"MultiPolygon","coordinates":[[[[121.525,25.020],[121.555,25.020],[121.555,25.045],[121.525,25.045],[121.525,25.020]]]]}},
    {"type":"Feature","properties":{"code":"65000","level":"county","name":"新北市","parent_code":null},"geometry":{"type":"MultiPolygon","coordinates":[[[[121.20,24.65],[121.45,24.65],[121.45,25.30],[121.20,25.30],[121.20,24.65]]]]}},
    {"type":"Feature","properties":{"code":"65000010","level":"township","name":"三重區","parent_code":"65000"},"geometry":{"type":"MultiPolygon","coordinates":[[[[121.475,25.060],[121.500,25.060],[121.500,25.090],[121.475,25.090],[121.475,25.060]]]]}}
  ]}'::jsonb AS data
)
INSERT INTO "admin_units" ("code", "level", "name", "parent_code", "geom")
SELECT
  feat->'properties'->>'code',
  (feat->'properties'->>'level')::admin_level,
  feat->'properties'->>'name',
  feat->'properties'->>'parent_code',
  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(feat->>'geometry'), 4326))::geometry(MultiPolygon, 4326)
FROM seed_data, jsonb_array_elements(seed_data.data->'features') AS feat;
