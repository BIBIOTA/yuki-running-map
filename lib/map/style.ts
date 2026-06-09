import type { StyleSpecification } from "maplibre-gl";

/**
 * Default MapLibre style consuming the Protomaps PMTiles configured via
 * NEXT_PUBLIC_PMTILES_URL. The style is intentionally minimal — colors map
 * to V2 Trail Vintage tokens so the map blends with the rest of the UI.
 *
 * Refresh / regeneration: see docs/runbooks/pmtiles-update.md.
 */
export function createDefaultStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          "<a href='https://protomaps.com'>Protomaps</a> © <a href='https://openstreetmap.org'>OpenStreetMap</a>",
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#F8F1E0" } },
      {
        id: "earth",
        type: "fill",
        source: "protomaps",
        "source-layer": "earth",
        paint: { "fill-color": "#ECE0C4" },
      },
      {
        id: "water",
        type: "fill",
        source: "protomaps",
        "source-layer": "water",
        paint: { "fill-color": "#BFA77A", "fill-opacity": 0.45 },
      },
      {
        id: "roads",
        type: "line",
        source: "protomaps",
        "source-layer": "roads",
        paint: { "line-color": "#D9C9A4", "line-width": 1 },
      },
    ],
  };
}
