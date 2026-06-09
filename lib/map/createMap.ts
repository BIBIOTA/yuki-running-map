import type { LngLatLike, Map as MapLibreMap } from "maplibre-gl";

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
  pmtilesUrl?: string;
}

/**
 * Mount a MapLibre map into `container`, fetching base tiles from a
 * Protomaps PMTiles file. Returns the map instance so the caller can attach
 * sources/layers (route lines, markers) or remove the map on unmount.
 *
 * Must be invoked from a Client Component — `maplibre-gl` touches `window`.
 */
export function createMap(
  container: HTMLElement,
  { center, zoom, pmtilesUrl = process.env.NEXT_PUBLIC_PMTILES_URL ?? "" }: CreateMapOptions,
): MapLibreMap {
  if (!pmtilesUrl) {
    throw new Error(
      "createMap: NEXT_PUBLIC_PMTILES_URL is not set. See docs/runbooks/pmtiles-update.md.",
    );
  }
  registerPmtilesProtocol();
  return new maplibre.Map({
    container,
    center,
    zoom,
    style: createDefaultStyle(pmtilesUrl),
  });
}
