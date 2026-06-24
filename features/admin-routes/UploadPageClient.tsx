"use client";

/**
 * `<UploadPageClient>` — the composition root for the admin
 * `/admin/upload` create flow.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       Requirement "UploadPageClient phase machine carries elevation + regions preview state"
 *
 * Phase machine (see ./uploadPagePhase.ts for the pure helpers):
 *
 *   { kind: 'empty' }
 *      └── dropzone visible; map + elevation + regions + form NOT mounted
 *   { kind: 'loaded', file, geojson, bbox, elevationProfile, regionsState }
 *      └── dropzone shows the loaded chip;
 *          map preview + ElevationProfile + RouteRegionsSection + form
 *          mount below.
 *
 * regionsState is seeded `loading` on file drop. We then await the
 * `previewRegions` Server Action and fold the result into the next
 * Phase via `applyPreviewRegionsResult`. Preview failure never blocks
 * submit — the canonical `detectRegions` runs inside `createRoute`'s
 * transaction and is the source of truth.
 *
 * Testability note: the React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./uploadPagePhase.ts` and
 * are covered by `__tests__/uploadPagePhase.test.ts`; the full
 * user-visible behaviour is exercised by the admin upload Playwright
 * spec (task 10.1).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RouteRegionsSection } from "@/components/RouteRegions";
import { previewRegions } from "@/features/admin-routes/actions/previewRegions";
import { createRoute } from "@/features/admin-routes/actions/createRoute";
import { ElevationProfile } from "@/features/route-detail/ElevationProfile";
import type { GpxMetadata } from "@/lib/gpx";

import { GpxDropzone } from "./GpxDropzone";
import { RouteMapPreview } from "./RouteMapPreview";
import { RouteMetadataForm } from "./RouteMetadataForm";
import type { RouteMetadataValues } from "./types";
import {
  buildCreateRouteFormData,
  buildSuccessToastText,
} from "./uploadPageState";
import {
  applyPreviewRegionsResult,
  buildLoadedPhase,
  type Phase,
} from "./uploadPagePhase";

export function UploadPageClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string> | undefined
  >(undefined);

  async function handleFile(file: File, parsed: GpxMetadata): Promise<void> {
    // Reset any prior submit-error state — picking a new file is the
    // user's signal that they intend to retry the whole flow.
    setFieldErrors(undefined);
    const next = buildLoadedPhase({
      file,
      geojson: parsed.geojson,
      bbox: parsed.bbox,
      elevationProfile: parsed.elevationProfile,
    });
    setPhase(next);

    // Kick off the read-only regions preview. Failure does not block the
    // user's submit — the canonical `detectRegions` runs server-side in
    // the `createRoute` transaction. We re-shape the GeoJSON LineString
    // coords to the tighter `[number, number]` tuple form the Action
    // expects (the GeoJSON spec types coords as `Position` which is
    // `number[]` and could in principle carry altitude as a third
    // element — parseGpx never emits one, but the type widens for the
    // GeoJSON spec).
    const previewInput = {
      type: "LineString" as const,
      coordinates: parsed.geojson.geometry.coordinates.map(
        (c) => [c[0], c[1]] as [number, number],
      ),
    };
    const result = await previewRegions(previewInput);
    setPhase((prev) => applyPreviewRegionsResult(prev, result));
  }

  async function handleSubmit(values: RouteMetadataValues): Promise<void> {
    if (phase.kind !== "loaded") return;
    setFieldErrors(undefined);
    const formData = buildCreateRouteFormData(values, phase.file);
    const result = await createRoute(formData);
    if (result.ok) {
      const text = buildSuccessToastText(values.title);
      if (values.published) {
        toast.success(text, {
          action: {
            label: "檢視",
            onClick: () => router.push(`/routes/${result.slug}`),
          },
        });
      } else {
        toast.success(text);
      }
      router.push("/admin/routes");
    } else {
      setFieldErrors(result.fieldErrors);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold">新增路線</h1>
        <p className="text-sm text-muted-foreground">
          拖放 GPX 檔即可建立新路線。
        </p>
      </div>

      <GpxDropzone onFile={handleFile} />

      {phase.kind === "loaded" ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <RouteMapPreview geojson={phase.geojson} bbox={phase.bbox} />
            <RouteMetadataForm
              mode="create"
              onSubmit={handleSubmit}
              fieldErrors={fieldErrors}
            />
          </div>

          <section
            aria-labelledby="upload-elevation-heading"
            className="space-y-2"
          >
            <h2
              id="upload-elevation-heading"
              className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
            >
              海拔曲線
            </h2>
            <div className="rounded-md border border-border bg-card p-3">
              <ElevationProfile profile={phase.elevationProfile} />
            </div>
          </section>

          <UploadRegionsSlot regionsState={phase.regionsState} />
        </>
      ) : null}
    </div>
  );
}

/**
 * `<UploadRegionsSlot>` — renders the four-state regions preview inside
 * the shared `<RouteRegionsSection>` chrome. Adds a `data-testid` +
 * `data-state` pair on each variant so e2e + unit tests can assert the
 * state transitions deterministically.
 */
function UploadRegionsSlot({
  regionsState,
}: {
  regionsState: import("./uploadPagePhase").RegionsState;
}) {
  if (regionsState.kind === "loading") {
    return (
      <div data-testid="upload-regions-state" data-state="loading">
        <RouteRegionsSection>
          <p className="text-sm text-muted-foreground">正在判斷區域…</p>
          <div
            className="h-5 w-72 max-w-full rounded bg-muted"
            aria-hidden="true"
          />
        </RouteRegionsSection>
      </div>
    );
  }
  if (regionsState.kind === "ready") {
    if (regionsState.regions.length === 0) {
      return (
        <div data-testid="upload-regions-state" data-state="ready-empty">
          <RouteRegionsSection>
            <p className="text-sm text-muted-foreground">
              此路線未涵蓋任何已知行政區。
            </p>
            <p className="text-xs text-muted-foreground">
              送出後仍會以 ST_Intersects 重新計算一次。
            </p>
          </RouteRegionsSection>
        </div>
      );
    }
    return (
      <div data-testid="upload-regions-state" data-state="ready">
        <RouteRegionsSection regions={regionsState.regions} />
      </div>
    );
  }
  return (
    <div data-testid="upload-regions-state" data-state="error">
      <RouteRegionsSection>
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 p-3"
        >
          <p className="text-sm font-medium text-destructive">
            ✕ 無法預覽區域
          </p>
          <p className="text-xs text-foreground">
            行政區預覽暫時無法使用。送出按鈕仍可使用，後端將以
            ST_Intersects 重算。
          </p>
        </div>
      </RouteRegionsSection>
    </div>
  );
}
