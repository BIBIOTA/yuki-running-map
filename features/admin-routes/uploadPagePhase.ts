/**
 * Pure state-machine helpers for `<UploadPageClient>`.
 *
 * The component owns the `Phase` discriminator that drives whether the
 * dropzone alone is visible (empty) or whether the map preview +
 * elevation profile + regions slot + metadata form are mounted (loaded).
 * `regionsState` is a nested discriminator carrying the four states the
 * `previewRegions` Server Action resolves into (loading / ready /
 * ready-empty / error).
 *
 * The helpers below are pure so they can be unit-tested in the node
 * vitest runner (no React testing library; see CLAUDE.md "no new deps").
 * The component itself is a thin wrapper that calls these and renders
 * the resulting state.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       Requirement "UploadPageClient phase machine carries elevation + regions preview state"
 */

import type { Feature, LineString } from "geojson";

import type { BBox2D } from "@/lib/gpx";
import type { Region } from "@/lib/regions/types";

import type { PreviewRegionsResult } from "./actions/previewRegions";

export type RegionsState =
  | { kind: "loading" }
  | { kind: "ready"; regions: Region[] }
  | { kind: "error"; message: string };

export type Phase =
  | { kind: "empty" }
  | {
      kind: "loaded";
      file: File;
      geojson: Feature<LineString>;
      bbox: BBox2D;
      elevationProfile: Array<[number, number]>;
      regionsState: RegionsState;
    };

export type LoadedPhaseSeed = {
  file: File;
  geojson: Feature<LineString>;
  bbox: BBox2D;
  elevationProfile: Array<[number, number]>;
};

/**
 * Build the `loaded` Phase variant seeded from a parseGpx() result.
 * The regions slot starts in `loading` because `previewRegions` runs
 * after the parse completes.
 */
export function buildLoadedPhase(seed: LoadedPhaseSeed): Phase {
  return {
    kind: "loaded",
    file: seed.file,
    geojson: seed.geojson,
    bbox: seed.bbox,
    elevationProfile: seed.elevationProfile,
    regionsState: { kind: "loading" },
  };
}

/**
 * Apply a `previewRegions` result to a `loaded` Phase. On `ok` the
 * regions slot transitions to `ready`; on `false` it transitions to
 * `error`. An `empty` phase is returned verbatim — there is no
 * meaningful transition when the user has not yet dropped a file.
 */
export function applyPreviewRegionsResult(
  phase: Phase,
  result: PreviewRegionsResult,
): Phase {
  if (phase.kind !== "loaded") return phase;
  if (result.ok) {
    return {
      ...phase,
      regionsState: { kind: "ready", regions: result.regions },
    };
  }
  return {
    ...phase,
    regionsState: { kind: "error", message: result.message },
  };
}

/**
 * Whether the submit button should be enabled for the current Phase.
 *
 * Per spec.md "previewRegions failure does not block submit", the submit
 * button stays enabled in all `loaded` sub-states. It is only disabled
 * in the `empty` phase because there is no file to upload yet.
 */
export function isSubmitEnabledForPhase(phase: Phase): boolean {
  return phase.kind === "loaded";
}
