# Runbook · `admin_units` refresh

Refresh the `admin_units` polygon dataset when 內政部 publishes a new year of administrative boundaries (typically every January after merger/rename announcements).

## When to run

- Annual: announcements at [內政部國土測繪中心](https://www.nlsc.gov.tw/).
- Ad-hoc: a routes-list filter shows an admin unit the spec says should no longer exist, or a path-intersection result includes a renamed region.

## Inputs

- `<input>.geojson` — the refreshed boundary data downloaded from [data.gov.tw](https://data.gov.tw/) "鄉鎮市區界線" + "縣市界線" datasets (GeoJSON variant). The original 內政部 source is SHP, but `data.gov.tw` publishes the same boundary data as GeoJSON; the project's `scripts/build-admin-units-geojson.ts` accepts GeoJSON to avoid adding a SHP parser dep.

## Step-by-step

1. **Download the refreshed boundary dataset** from data.gov.tw. The dataset properties should carry `COUNTYCODE` / `COUNTYNAME` for counties and `TOWNCODE` / `TOWNNAME` + `COUNTYCODE` for townships.

2. **Normalise via the dev-side script**:

   ```bash
   pnpm tsx scripts/build-admin-units-geojson.ts <input>.geojson \
     lib/db/migrations/seed/taiwan-admin-units.geojson
   ```

   The script writes a normalised FeatureCollection (`code` / `level` / `name` / `parent_code` properties, `MultiPolygon` geometry) at the seed path. Self-intersecting polygons are NOT repaired here — `ST_MakeValid` runs DB-side at insert time.

3. **Write a new migration `NNNN_refresh_taiwan_admin_units.sql`**:

   ```sql
   -- Wipe join + dataset; CASCADE clears route_admin_units atomically.
   TRUNCATE TABLE admin_units CASCADE;

   -- Re-seed by inlining the new GeoJSON literal — same pattern as 0007.
   WITH seed_data AS ( SELECT '...new feature collection...'::jsonb AS data )
   INSERT INTO "admin_units" ("code", "level", "name", "parent_code", "geom")
   SELECT
     feat->'properties'->>'code',
     (feat->'properties'->>'level')::admin_level,
     feat->'properties'->>'name',
     feat->'properties'->>'parent_code',
     ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(feat->>'geometry'), 4326))::geometry(MultiPolygon, 4326)
   FROM seed_data, jsonb_array_elements(seed_data.data->'features') AS feat;

   -- Re-detect regions for every published route.
   INSERT INTO "route_admin_units" ("route_id", "admin_unit_id")
   SELECT r.id, a.id
     FROM "routes" r
     JOIN "admin_units" a
       ON ST_Intersects(
            a.geom,
            ST_SetSRID(ST_GeomFromGeoJSON(r.geojson->>'geometry'), 4326)
          );
   ```

   Tip: when the boundary set is large, copy the JSON literal into a `\set seed_json '''…'''` and reference `:seed_json` to keep the migration file readable.

4. **Update the journal** (`lib/db/migrations/meta/_journal.json`) with the new entry.

5. **Run the migration locally first**:

   ```bash
   pnpm db:migrate
   ```

6. **Verify in `psql`**:

   ```sql
   SELECT level, COUNT(*) FROM admin_units GROUP BY level;
   -- expected: 22 counties + ~370 townships (varies by year)

   SELECT COUNT(*) FROM route_admin_units;
   -- non-zero if there are published routes
   ```

7. **Commit + deploy** with the new migration filename.

## Rollback

The TRUNCATE in step 3 is destructive but the data is regenerable from the seed file. To roll back to a previous boundary set, replay the previous migration's seed inline.

## Trade-offs documented in the spec

- **Why GeoJSON, not SHP**: see the script header in `scripts/build-admin-units-geojson.ts` and design.md §5.1 inventory note. Adding a SHP parser dep would violate CLAUDE.md's no-new-deps rule.
- **Why TRUNCATE + re-INSERT (not UPDATE)**: 內政部 occasionally splits / merges townships, so identity-preserving UPDATE would be hard to reason about. Wiping + re-detecting from scratch is simpler and only runs annually.
