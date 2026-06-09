# PMTiles update runbook

Yuki's Running Map renders its base map from a single Protomaps PMTiles
file hosted on Supabase Storage. This runbook explains the **bundle
scope**, the **`pmtiles extract` command**, the **Storage path
convention**, and how to **roll `NEXT_PUBLIC_PMTILES_URL`** without
breaking running clients.

## Bundle scope

The world-wide Protomaps build is ~100GB which is impractical to host
on the free Supabase Storage tier. Bundle only the areas Yuki actually
runs in:

- **Taiwan** (台灣本島 + 離島)
- Plus any **frequently visited countries** (initial set: Japan).

A Taiwan-only bundle is ~600MB; Taiwan + Japan is ~3GB. Both fit
comfortably inside the 1GB/100GB-per-month free tier.

## Prerequisites

- `go` 1.22+ on `$PATH` (the `pmtiles` CLI is a Go binary).
- A Protomaps **planet** PMTiles download. Get it from
  <https://maps.protomaps.com/builds/> — pick the most recent
  `YYYY-MM-DD.pmtiles`. ~100GB. Do this once on a machine with
  enough disk + bandwidth.

## Extract sub-region with `pmtiles extract`

```bash
# Install pmtiles CLI (Go binary)
go install github.com/protomaps/go-pmtiles@latest

# Bounding boxes — adjust as Yuki's runs expand
TAIWAN_BBOX="119.3,21.5,122.3,25.5"
JAPAN_BBOX="122.5,24.0,146.5,46.0"

# Extract Taiwan-only tileset from the planet build
pmtiles extract \
  planet-2026-01-01.pmtiles \
  taiwan-2026-01.pmtiles \
  --bbox="$TAIWAN_BBOX"

# Or a combined Taiwan + Japan bundle
pmtiles extract \
  planet-2026-01-01.pmtiles \
  taiwan-japan-2026-01.pmtiles \
  --bbox="$TAIWAN_BBOX" \
  --bbox="$JAPAN_BBOX"
```

Resulting file should be 0.5–3 GB depending on scope.

## Storage path convention

Upload to Supabase Storage under the `tiles` bucket (public read):

```
tiles/
  taiwan-2026-01.pmtiles      ← versioned by year-month
  taiwan-japan-2026-01.pmtiles
  latest.pmtiles              ← symlink-style copy of the current build
```

Convention:

- Filename includes the build date (e.g. `taiwan-2026-01.pmtiles`).
- `latest.pmtiles` is overwritten in-place on each refresh.
- Keep the previous versioned file around for **two refresh cycles**
  so any cached browser sessions can finish their map session before
  the underlying tiles disappear.

## Roll `NEXT_PUBLIC_PMTILES_URL` without breakage

1. Upload the new file to Storage (e.g. `taiwan-2026-04.pmtiles`).
2. Verify by opening it locally with `pmtiles show <url>`.
3. Update **Vercel env** `NEXT_PUBLIC_PMTILES_URL` for **Preview** first.
4. Open a Preview deploy, sanity-check the map.
5. Promote: update **Production** env var to the new URL.
6. Vercel will rebuild and ship within ~60s.
7. Leave the previous version file in Storage for **two weeks** before
   deletion (covers in-flight browser sessions and CDN caches).

## Verifying after rollout

- Open `/routes/<any-published-slug>` in production.
- The map should load without console errors.
- Network tab should show `range` requests against the new
  `pmtiles` URL.
- If MapLibre shows a blank base, check the browser console for
  `Failed to fetch pmtiles` — typically the env var was not updated
  or Storage bucket permissions changed.

## When to refresh

- **Quarterly** as a routine, to pick up the latest OSM data.
- **On demand** when Yuki starts running in a new country (extract a
  new combined bundle with the larger bbox set).
