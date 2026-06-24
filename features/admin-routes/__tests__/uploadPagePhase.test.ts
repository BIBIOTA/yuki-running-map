/**
 * Unit tests for the `UploadPageClient` Phase machine helpers.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       Requirement "UploadPageClient phase machine carries elevation + regions preview state"
 *
 * Scenarios covered:
 *   - "Drop triggers elevation seed + previewRegions"
 *   - "previewRegions failure does not block submit"
 *
 * The full client-side React flow is exercised by Playwright (task 10.1).
 * Here we cover the pure state transitions on the Phase discriminator so
 * the heart of the logic stays node-testable.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildLoadedPhase,
  applyPreviewRegionsResult,
  isSubmitEnabledForPhase,
} from "../uploadPagePhase";
import type { RegionsState } from "../uploadPagePhase";
import type { Region } from "@/lib/regions/types";

const SAMPLE_GEOJSON = {
  type: "Feature" as const,
  geometry: {
    type: "LineString" as const,
    coordinates: [
      [121.515, 25.04],
      [121.535, 25.04],
    ] as Array<[number, number]>,
  },
  properties: {},
};

const SAMPLE_BBOX = [121.515, 25.04, 121.535, 25.04] as [
  number,
  number,
  number,
  number,
];

const SAMPLE_PROFILE: Array<[number, number]> = [
  [0, 10],
  [1000, 80],
];

const SAMPLE_FILE = new File(["<gpx></gpx>"], "track.gpx");

describe("UploadPageClient Phase machine", () => {
  it("Drop triggers elevation seed + previewRegions", () => {
    const phase = buildLoadedPhase({
      file: SAMPLE_FILE,
      geojson: SAMPLE_GEOJSON,
      bbox: SAMPLE_BBOX,
      elevationProfile: SAMPLE_PROFILE,
    });
    expect(phase.kind).toBe("loaded");
    if (phase.kind !== "loaded") return;
    expect(phase.elevationProfile).toEqual(SAMPLE_PROFILE);
    expect(phase.regionsState).toEqual({ kind: "loading" });
    expect(phase.file).toBe(SAMPLE_FILE);
    expect(phase.geojson).toEqual(SAMPLE_GEOJSON);
    expect(phase.bbox).toEqual(SAMPLE_BBOX);
  });

  it("applies a successful previewRegions result to the Phase", () => {
    const phase = buildLoadedPhase({
      file: SAMPLE_FILE,
      geojson: SAMPLE_GEOJSON,
      bbox: SAMPLE_BBOX,
      elevationProfile: SAMPLE_PROFILE,
    });
    const regions: Region[] = [
      { code: "65000", level: "county", name: "新北市", parent_code: null },
    ];
    const next = applyPreviewRegionsResult(phase, {
      ok: true,
      regions,
    });
    if (next.kind !== "loaded") throw new Error("expected loaded");
    expect(next.regionsState).toEqual({ kind: "ready", regions });
  });

  it("previewRegions failure does not block submit", () => {
    const phase = buildLoadedPhase({
      file: SAMPLE_FILE,
      geojson: SAMPLE_GEOJSON,
      bbox: SAMPLE_BBOX,
      elevationProfile: SAMPLE_PROFILE,
    });
    const next = applyPreviewRegionsResult(phase, {
      ok: false,
      message: "行政區預覽暫時無法使用",
    });
    if (next.kind !== "loaded") throw new Error("expected loaded");
    expect(next.regionsState).toEqual({
      kind: "error",
      message: "行政區預覽暫時無法使用",
    });
    // The contract: submit stays enabled even when regions preview errored.
    expect(isSubmitEnabledForPhase(next)).toBe(true);
  });

  it("submit is disabled before a file has been dropped (empty phase)", () => {
    expect(isSubmitEnabledForPhase({ kind: "empty" })).toBe(false);
  });

  it("submit is enabled in all three loaded states (loading / ready / ready-empty)", () => {
    const make = (regionsState: RegionsState) => ({
      kind: "loaded" as const,
      file: SAMPLE_FILE,
      geojson: SAMPLE_GEOJSON,
      bbox: SAMPLE_BBOX,
      elevationProfile: SAMPLE_PROFILE,
      regionsState,
    });
    expect(isSubmitEnabledForPhase(make({ kind: "loading" }))).toBe(true);
    expect(
      isSubmitEnabledForPhase(make({ kind: "ready", regions: [] })),
    ).toBe(true);
    expect(
      isSubmitEnabledForPhase(
        make({
          kind: "ready",
          regions: [
            { code: "65000", level: "county", name: "新北市", parent_code: null },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isSubmitEnabledForPhase(make({ kind: "error", message: "x" })),
    ).toBe(true);
  });
});

describe("UploadPageClient JSX wiring", () => {
  /**
   * The actual render path (RouteMapPreview / ElevationProfile /
   * RouteRegionsSection / RouteMetadataForm) is covered by the Playwright
   * e2e spec (task 10.1). Here we assert the source-level contract that
   * the necessary imports are present so a refactor cannot silently break
   * the layout.
   */
  const source = readFileSync(
    join(process.cwd(), "features/admin-routes/UploadPageClient.tsx"),
    "utf-8",
  );

  it("Loaded phase mounts the elevation section", () => {
    expect(source).toMatch(/<ElevationProfile/);
    expect(source).toMatch(/aria-labelledby="upload-elevation-heading"/);
    expect(source).toMatch(/海拔曲線/);
  });

  it("imports previewRegions Server Action + the shared RouteRegionsSection", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*previewRegions[^}]*\}\s*from\s*"@\/features\/admin-routes\/actions\/previewRegions"/,
    );
    expect(source).toMatch(
      /import\s*\{[^}]*RouteRegionsSection[^}]*\}\s*from\s*"@\/components\/RouteRegions"/,
    );
  });

  it("Renders the regions slot with the four state variants tag", () => {
    expect(source).toMatch(/data-testid="upload-regions-state"/);
    expect(source).toMatch(/data-state="loading"/);
    expect(source).toMatch(/data-state="ready"/);
    expect(source).toMatch(/data-state="ready-empty"/);
    expect(source).toMatch(/data-state="error"/);
  });
});

describe("EditPageClient elevation section", () => {
  const source = readFileSync(
    join(process.cwd(), "features/admin-routes/EditPageClient.tsx"),
    "utf-8",
  );

  it("Edit page mounts the elevation section beneath the map", () => {
    expect(source).toMatch(/<ElevationProfile/);
    expect(source).toMatch(/aria-labelledby="edit-elevation-heading"/);
    expect(source).toMatch(/海拔曲線/);
  });
});
