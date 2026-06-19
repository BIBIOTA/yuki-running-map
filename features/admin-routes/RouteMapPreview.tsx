"use client";

/**
 * `<RouteMapPreview>` — read-only MapLibre preview that overlays a parsed
 * GPX track on the PMTiles base map. Used by the admin upload flow
 * (`UploadPageClient`, task 4.x) and the edit flow to give the route
 * author visual confirmation that the uploaded file looks right before
 * they hit submit.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §3.3
 * Design: openspec/changes/feat-admin-gpx-upload/design.md:95
 *
 * Behaviour:
 * - When `geojson` or `bbox` is null the component renders nothing
 *   (the parent should mount it only after `parseGpx` succeeds).
 * - On mount it calls `lib/map/createMap` to boot a MapLibre instance,
 *   then once the style loads it adds a GeoJSON `LineString` source
 *   plus a line layer and calls `fitBounds` with the GPX bbox.
 * - On unmount (or when `geojson` / `bbox` change) the previous map is
 *   removed via `map.remove()` to avoid leaking WebGL contexts.
 *
 * Token note: MapLibre's paint properties do NOT understand CSS
 * variables — `paint["line-color"]` must be a literal CSS color string.
 * The literal `#c26a3d` below is the same hex backing the
 * `--map-route-line` / `--color-map-route-line` Trail Vintage token
 * defined in `app/globals.css:55`; if that token changes this paint
 * value should be updated in lock-step (or read at runtime via
 * `getComputedStyle` — deferred until we actually theme the map).
 *
 * Testability note: the visual rendering depends on `maplibre-gl`, which
 * needs a real browser (WebGL + window). The project deliberately keeps
 * Vitest in the node environment with no React testing library — adding
 * one would violate CLAUDE.md's "no new deps" guardrail. Pure transforms
 * live in `./mapPreview.ts` and are covered by
 * `__tests__/mapPreview.test.ts`; the full visual behaviour is exercised
 * by the admin upload Playwright spec (task 5.1).
 */

import type { Feature, LineString } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { createMap } from "@/lib/map/createMap";
import type { BBox2D } from "@/lib/gpx";

import { bboxCenter, bboxToFitBoundsTuple } from "./mapPreview";

type Props = {
  geojson: Feature<LineString> | null;
  bbox: BBox2D | null;
  className?: string;
};

export function RouteMapPreview({ geojson, bbox, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || !geojson || !bbox) return;

    const map = createMap(containerRef.current, {
      center: bboxCenter(bbox),
      zoom: 10,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: geojson });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // V2 Trail Vintage rust orange — mirror of `--map-route-line`
          // in app/globals.css. MapLibre paint does not resolve CSS vars.
          "line-color": "#c26a3d",
          "line-width": 4,
        },
      });
      map.fitBounds(bboxToFitBoundsTuple(bbox), { padding: 32 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson, bbox]);

  if (!geojson || !bbox) return null;

  return (
    <div
      ref={containerRef}
      className={className ?? "h-72 w-full rounded-md border border-border"}
      role="img"
      aria-label="路線預覽地圖"
    />
  );
}
