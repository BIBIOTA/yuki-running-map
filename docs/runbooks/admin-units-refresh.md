# Runbook · `admin_units` refresh

Refresh the `admin_units` polygon dataset when 內政部 publishes a new year of administrative boundaries (typically every January after merger/rename announcements).

## When to run

- Annual: announcements at [內政部國土測繪中心](https://www.nlsc.gov.tw/).
- Ad-hoc: a routes-list filter shows an admin unit the spec says should no longer exist, or a path-intersection result includes a renamed region.

## Primary source: g0v GeoJSON mirror

The `pnpm refresh:admin-units` script (added by `refresh-taiwan-admin-units`) does steps 1–2 in one shot — it fetches the [g0v/twgeojson](https://github.com/g0v/twgeojson) mirror over HTTPS, merges counties + townships into one FeatureCollection, calls `normalizeAdminUnits` (which accepts both 內政部 `COUNTYCODE`/`TOWNCODE` and g0v `COUNTYSN`/`TOWNSN` shapes), prefixes every `code` with its level (`county:<sn>` / `township:<sn>`) to avoid the 21+ COUNTYSN/TOWNSN collisions in the real dataset, and writes the normalised seed to `lib/db/migrations/seed/taiwan-admin-units.geojson`.

```bash
pnpm refresh:admin-units
# → Wrote ~399 features to lib/db/migrations/seed/taiwan-admin-units.geojson
```

Vintage trade-off: g0v's mirror is the 2010 county / 1982 township boundary. County boundaries have been highly stable in Taiwan; township boundaries change only in rare merge/rename events. The latest 內政部 1140318 vintage is available as SHP only — see the **Alternate** section below if you need it.

## Step-by-step

1. **Generate the seed** via `pnpm refresh:admin-units` (above).

2. _(skipped — folded into step 1.)_

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

## Local only

Run this migration **only against your local Supabase**. Production deploy follows the regular Vercel / Supabase CI path; never apply a refresh directly to prod via `pnpm db:migrate`.

## Drizzle-kit + large migrations

The drizzle-kit migrator hangs when the migration file is in the tens of megabytes (the 0010 seed is ~68 MB). If `pnpm db:migrate` stalls, apply the migration directly via a tiny postgres-js script:

```bash
node --env-file=.env.local -e "
  const fs = require('fs');
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  (async () => {
    const body = fs.readFileSync('lib/db/migrations/NNNN_refresh_taiwan_admin_units.sql', 'utf-8');
    for (const stmt of body.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) {
      await sql.unsafe(stmt);
    }
    // Record into drizzle's journal so future db:migrate is idempotent.
    await sql\\\`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('manual_NNNN_refresh_taiwan_admin_units', \\\${Date.now()})\\\`;
    await sql.end();
  })().catch(e => { console.error(e); process.exit(1); });
"
```

This bypasses drizzle-kit's slow path and runs each statement directly. The journal `INSERT` keeps subsequent `pnpm db:migrate` runs idempotent.

## Rollback

The `TRUNCATE` in step 3 is destructive but the data is regenerable from the seed file. To roll back to a previous boundary set, replay the previous migration's seed inline.

## Alternate: latest 內政部 vintage (requires brew install gdal)

If you need the authoritative 內政部 vintage (e.g. 1140318 = 2025/03/18), download the SHP archive from data.gov.tw datasets [7442 (縣市界線)](https://data.gov.tw/dataset/7442) + [7441 (鄉鎮市區界線)](https://data.gov.tw/dataset/7441). The 內政部 datasets ship only SHP, so you need GDAL's `ogr2ogr` to convert:

```bash
brew install gdal
unzip COUNTY_MOI_1140318_.zip -d /tmp/county
ogr2ogr -f GeoJSON /tmp/county.geojson /tmp/county/COUNTY_MOI_1140318.shp
unzip 鄉\(鎮、市、區\)界線1140318.zip -d /tmp/town
ogr2ogr -f GeoJSON /tmp/town.geojson /tmp/town/TOWN_MOI_1140318.shp
# Merge the two FeatureCollections by hand or via the existing
# scripts/build-admin-units-geojson.ts helper.
pnpm tsx scripts/build-admin-units-geojson.ts <merged>.geojson \
  lib/db/migrations/seed/taiwan-admin-units.geojson
```

The 內政部 SHP properties use `COUNTYCODE` / `TOWNCODE`, which `normalizeAdminUnits` already accepts — no normaliser change needed.

## Trade-offs documented in the spec

- **Why g0v GeoJSON, not SHP**: g0v mirrors the boundary data as GeoJSON over HTTPS, so a one-line `curl` does the job. Adding GDAL / a SHP parser is a heavier prerequisite and is only needed for the latest 內政部 vintage.
- **Why TRUNCATE + re-INSERT (not UPDATE)**: 內政部 occasionally splits / merges townships, so identity-preserving UPDATE would be hard to reason about. Wiping + re-detecting from scratch is simpler and only runs annually.
- **Why level-prefixed codes**: g0v's 8-digit COUNTYSN and TOWNSN share the same numeric space — 21+ codes collide in real data. Prefixing (`county:<sn>` / `township:<sn>`) is the smallest change that lets the existing `admin_units.code UNIQUE NOT NULL` accept the dataset.
