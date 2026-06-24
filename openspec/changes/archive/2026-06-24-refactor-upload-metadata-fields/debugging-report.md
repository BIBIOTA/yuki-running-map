# Debugging Report: refactor-upload-metadata-fields

Date: 2026-06-24
Debugger: claude-code session (Opus 4.7)

## Symptom

- Reported behavior: Upload preview on `/admin/upload` shows 「途經區域 · 此路線未涵蓋任何已知行政區」 after dropping `Afternoon_Run.gpx`.
- Expected behavior: 「新北市 — 瑞芳區」 (the GPX starts at lon 121.82194, lat 25.10283 which is inside 瑞芳區).
- Impact: The new `previewRegions` Server Action appears broken, but actually the spatial query is correct — the local `admin_units` seed is a 5-row stub fixture that does not contain the real 內政部 polygons. Every real-world GPX outside the 5 stub polygons (台北市 county / 中正區 / 大安區 / 新北市 county stub / 三重區) will hit this branch.

## Reproduction

- Status: **reproduced**
- Steps:
  1. `pnpm dev` (port 3001 since 3000 is occupied).
  2. Sign in as admin, navigate to `/admin/upload`.
  3. Drop `/Users/bibiota/Downloads/Afternoon_Run.gpx`.
  4. Observe 「途經區域 · 此路線未涵蓋任何已知行政區」.
- Environment: local Supabase + applied migrations 0001-0009.
- Test data: GPX starting point `(lon=121.821940, lat=25.102832)`. Manually verified via 內政部 / Google Maps that this is inside 新北市瑞芳區.

## Observation Plan

| Layer | Observation method | Evidence captured |
|---|---|---|
| Browser/UI | Manual drop on `/admin/upload`; observed empty regions slot. | User confirmed reproduction. |
| Server Action | `previewRegions(geometry)` calls `detectRegions(db, geometry)` → SELECT against `admin_units`. | Code path verified clean (`features/admin-routes/actions/previewRegions.ts`). |
| Database (PostGIS) | Direct SQL probe with the GPX start point + 5-point LineString. | See evidence below — PostGIS confirms 0 intersecting rows. |
| Seed data | Inspected `lib/db/migrations/0007_seed_taiwan_admin_units.sql` and `lib/db/migrations/seed/taiwan-admin-units.geojson`. | Found 5-row stub fixture; 瑞芳區 absent; 新北市 polygon is a 4-corner rectangle ending at lon=121.45. |

## Evidence

### Point probe at GPX start

```text
SELECT code, level, name, parent_code
  FROM admin_units
 WHERE ST_Intersects(geom,
        ST_SetSRID(ST_MakePoint(121.82194, 25.10283), 4326));
-- Result(0) — nothing matches.
```

### LineString probe (first 5 trkpts)

```text
SELECT code, level, name
  FROM admin_units
 WHERE ST_Intersects(geom,
        ST_SetSRID(ST_GeomFromGeoJSON({"type":"LineString","coordinates":[
          [121.821940,25.102832],
          [121.821967,25.102839],
          [121.822, 25.103],
          [121.823, 25.104],
          [121.824, 25.105]
        ]}), 4326));
-- Result(0) — nothing matches.
```

### Coverage of the local `admin_units` table

```text
SELECT level, COUNT(*) FROM admin_units GROUP BY level;
-- county    : 2
-- township  : 3

SELECT code, name, level, ST_AsText(ST_Envelope(geom)) AS bbox
  FROM admin_units;
-- 63000     台北市  county    POLYGON((121.45 24.96, 121.66 25.21))
-- 63000010  中正區  township  POLYGON((121.500 25.035, 121.525 25.055))
-- 63000020  大安區  township  POLYGON((121.525 25.020, 121.555 25.045))
-- 65000     新北市  county    POLYGON((121.20 24.65, 121.45 25.30))  ← east edge 121.45, GPX is at 121.82
-- 65000010  三重區  township  POLYGON((121.475 25.060, 121.500 25.090))
```

### Distance from the GPX point to every row in `admin_units`

```text
                                            lon-lat distance (degrees)
台北市 (county)                               0.16
大安區 (township)                             0.27
中正區 (township)                             0.30
三重區 (township)                             0.32
新北市 (county)                               0.37   ← furthest of the 5
```

The nearest row in the table is 0.16° away (~17 km west of the GPX start point). 瑞芳區 is not in the table at all.

### Seed source file

```text
$ wc -c lib/db/migrations/seed/taiwan-admin-units.geojson
2503 bytes  ← the real 內政部 dataset would be ~10-30 MB.
```

The seed file is the placeholder FeatureCollection committed by `feat-gpx-driven-route-metadata` task 3.24. `docs/runbooks/admin-units-refresh.md` documents that the production refresh path is:

1. Download the boundary data from data.gov.tw 鄉鎮市區界線 + 縣市界線 datasets.
2. Run `pnpm tsx scripts/build-admin-units-geojson.ts <input>.geojson lib/db/migrations/seed/taiwan-admin-units.geojson`.
3. Write a new migration `NNNN_refresh_taiwan_admin_units.sql` that `TRUNCATE … CASCADE`s and re-INSERTs.

That refresh has never been executed on this branch (or `main`).

## Data Flow Trace

- **Symptom observed at**: browser — `data-state="ready-empty"` rendered in the regions slot.
- **First incorrect state found at**: `admin_units` table — the polygons present do not cover real Taiwan; the GPX point cannot intersect anything.
- **Boundary where expected became actual**: `detectRegions()` SQL execution — PostGIS dutifully returns `[]` because the table content is the stub fixture, not the real dataset. The query semantics, the GeoJSON shape, the lon/lat order, the SRID, the index, and the `previewRegions` orchestration are all correct.

## Working Reference

- **Reference**: the seed migration `0007_seed_taiwan_admin_units.sql` was authored with only 5 features and `docs/runbooks/admin-units-refresh.md` was simultaneously committed describing how to refresh — i.e. the prior change deferred the real seed to a runbook-driven follow-up.
- **Meaningful differences**: a real Taiwan dataset has 22 counties + ~370 townships covering longitude 119–122° and latitude 21.9–25.4°; the stub has 2 counties + 3 townships covering 121.2–121.66°, 24.65–25.30° only.

## Hypothesis

I think the root cause is **the local `admin_units` table content is a placeholder 5-row stub** because:

- PostGIS direct probe with the exact GPX point returns 0 intersections.
- 瑞芳區 is absent from `admin_units` (only 5 rows total).
- The 新北市 polygon's bbox stops at lon 121.45, but the GPX is at lon 121.82.
- The seed file `taiwan-admin-units.geojson` is 2.5 KB (the real dataset is megabytes).
- The runbook `docs/runbooks/admin-units-refresh.md` documents the refresh path but has never been executed.

`previewRegions`, `detectRegions`, the schema, the index, and the spec scenarios are all correct. The change `refactor-upload-metadata-fields` does NOT introduce this bug; it surfaces a pre-existing data gap from `feat-gpx-driven-route-metadata`.

## Next Action

- **Route to**: a NEW change (`refresh-taiwan-admin-units` or similar) that executes the runbook in `docs/runbooks/admin-units-refresh.md`. Steps:

  1. Download `COUNTY_MOI_1130819.geojson` + `TOWN_MOI_1130819.geojson` (or the latest 內政部 release) from <https://data.gov.tw/dataset/7442> + <https://data.gov.tw/dataset/7441>.
  2. Run `pnpm tsx scripts/build-admin-units-geojson.ts <download>.geojson lib/db/migrations/seed/taiwan-admin-units.geojson` to normalise.
  3. Write `lib/db/migrations/0010_refresh_taiwan_admin_units.sql` with `TRUNCATE admin_units CASCADE;` + the new inlined FeatureCollection.
  4. Run `pnpm db:migrate`.
  5. Re-verify the GPX upload — the regions slot should show 「新北市 — 瑞芳區」.

- **Minimal fix/test direction**: do NOT modify `refactor-upload-metadata-fields` code. The change passes spec verification as authored; the seed gap is owned by the prior `feat-gpx-driven-route-metadata` capability and the runbook documented there.

- **Optional quick-verify shortcut** (not a fix — just to prove `previewRegions` works on real data): seed a single hand-crafted 新北市 + 瑞芳區 polygon pair via psql, re-upload the GPX, observe the chip render correctly, then revert. This isolates the spatial query as healthy without committing to a full dataset refresh.
