import type { LngLatLike, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import maplibre from "maplibre-gl";
import { Protocol } from "pmtiles";

import { createDefaultStyle } from "./style";

let pmtilesRegistered = false;

/**
 * Register the pmtiles:// protocol on MapLibre's request transformer once per
 * page lifetime. Safe to call multiple times — re-registration is idempotent.
 */
function registerPmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibre.addProtocol("pmtiles", protocol.tile);
  pmtilesRegistered = true;
}

export interface CreateMapOptions {
  center: LngLatLike;
  zoom: number;
  /**
   * Override URL. If omitted, resolves at call time from environment in this
   * order:
   *
   *   1. `NEXT_PUBLIC_MAP_STYLE_URL` — a full MapLibre style JSON URL
   *      (e.g. OpenFreeMap's hosted Liberty/Positron/etc.). Used as-is.
   *   2. `NEXT_PUBLIC_PMTILES_URL` — a `.pmtiles` archive URL. Wrapped in
   *      `createDefaultStyle` and consumed via the `pmtiles://` protocol.
   */
  pmtilesUrl?: string;
}

/**
 * Mount a MapLibre map into `container`. Two base-map paths are supported:
 *
 * - **Protomaps PMTiles** (production-canonical, per
 *   `docs/runbooks/pmtiles-update.md`): set `NEXT_PUBLIC_PMTILES_URL` to a
 *   `.pmtiles` archive. We register the `pmtiles://` protocol and wrap the
 *   archive in `createDefaultStyle` so it blends with the V2 Trail Vintage
 *   palette.
 * - **Hosted style URL** (dev / fallback): set
 *   `NEXT_PUBLIC_MAP_STYLE_URL` to a full style JSON URL such as
 *   OpenFreeMap's `https://tiles.openfreemap.org/styles/positron`. MapLibre
 *   fetches the style directly — no PMTiles protocol needed. Schema is
 *   whatever the host serves (e.g. Shortbread for OpenFreeMap) so V2 colour
 *   blending does not apply.
 *
 * If both env vars are set, `NEXT_PUBLIC_MAP_STYLE_URL` wins.
 *
 * Must be invoked from a Client Component — `maplibre-gl` touches `window`.
 */
export function createMap(
  container: HTMLElement,
  { center, zoom, pmtilesUrl }: CreateMapOptions,
): MapLibreMap {
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "";
  const archiveUrl = pmtilesUrl ?? process.env.NEXT_PUBLIC_PMTILES_URL ?? "";

  if (!styleUrl && !archiveUrl) {
    throw new Error(
      "createMap: neither NEXT_PUBLIC_MAP_STYLE_URL nor NEXT_PUBLIC_PMTILES_URL is set. See docs/runbooks/pmtiles-update.md.",
    );
  }

  // Style URL wins when both are present — useful for switching between
  // PMTiles (production) and a hosted fallback (dev) without removing the
  // PMTiles entry from .env.local.
  const style: StyleSpecification | string = styleUrl
    ? styleUrl
    : (registerPmtilesProtocol(), createDefaultStyle(archiveUrl));

  return new maplibre.Map({
    container,
    center,
    zoom,
    style,
  });
}
