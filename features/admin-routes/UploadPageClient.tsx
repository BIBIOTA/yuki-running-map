"use client";

/**
 * `<UploadPageClient>` — the composition root for the admin
 * `/admin/upload` create flow. Owns the two-phase state machine
 * (empty → loaded) that drives whether the dropzone alone is
 * visible or whether the map preview + metadata form are mounted
 * alongside it, and orchestrates the `createRoute` Server Action
 * round-trip on submit.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"<UploadPageClient>" composition Scenarios
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §3.7
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 01
 *        - `screenshots/01-upload-happy.png` — top nav 「上傳」active,
 *          page hero 「新增路線」 + 副標, GpxDropzone in the empty
 *          state; after file pickup the dropzone collapses to its
 *          loaded chip and the map preview + metadata form render
 *          below in a two-column md: grid.
 *
 * Phase machine:
 *
 *   { kind: 'empty' }
 *      └── dropzone visible; map + form NOT mounted
 *   { kind: 'loaded', file, geojson, bbox }
 *      └── dropzone shows the loaded chip; map + form mount below
 *
 * Server Action wiring (deliberate trade-offs documented below):
 *
 *   - `useTransition` is NOT used here. The reference design suggested
 *     wrapping `createRoute(formData)` in `startTransition` for the
 *     pending state, but `<RouteMetadataForm>` already manages its own
 *     `submitting` state via `await onSubmit(values)` — the button
 *     disables itself for the duration of the awaited promise. Adding
 *     `useTransition` on top would duplicate the disable signal and
 *     complicate result handling because `startTransition`'s callback
 *     return value is discarded. Awaiting the Action directly is the
 *     simpler, correct pattern.
 *   - `router.push('/admin/routes')` runs AFTER the success toast is
 *     dispatched. sonner toasts live in the root layout's `<Toaster>`,
 *     so they survive the navigation and remain visible on the routes
 *     list page.
 *   - The 「檢視」 toast action is only attached when
 *     `values.published === true`. Unpublished routes do not have a
 *     public `/routes/${slug}` page (the route table filter respects
 *     the `published` column), so offering the link would lead to a
 *     404. The toast still fires; just without the action.
 *
 * Testability note: the React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./uploadPageState.ts` and
 * are covered by `__tests__/uploadPageState.test.ts`; the full
 * user-visible behaviour (drop → preview → submit → toast →
 * navigation) is exercised by the admin upload Playwright spec
 * (task 5.1).
 */

import type { Feature, LineString } from "geojson";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createRoute } from "@/features/admin-routes/actions/createRoute";
import type { BBox2D, GpxMetadata } from "@/lib/gpx";

import { GpxDropzone } from "./GpxDropzone";
import { RouteMapPreview } from "./RouteMapPreview";
import { RouteMetadataForm } from "./RouteMetadataForm";
import type { RouteMetadataValues } from "./types";
import {
  buildCreateRouteFormData,
  buildSuccessToastText,
} from "./uploadPageState";

type Phase =
  | { kind: "empty" }
  | {
      kind: "loaded";
      file: File;
      geojson: Feature<LineString>;
      bbox: BBox2D;
    };

type Props = {
  existingTags: string[];
};

export function UploadPageClient({ existingTags }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string> | undefined
  >(undefined);

  function handleFile(file: File, parsed: GpxMetadata): void {
    // Reset any prior submit-error state — picking a new file is the
    // user's signal that they intend to retry the whole flow.
    setFieldErrors(undefined);
    setPhase({
      kind: "loaded",
      file,
      geojson: parsed.geojson,
      bbox: parsed.bbox,
    });
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
        <div className="grid gap-6 md:grid-cols-2">
          <RouteMapPreview geojson={phase.geojson} bbox={phase.bbox} />
          <RouteMetadataForm
            mode="create"
            existingTags={existingTags}
            onSubmit={handleSubmit}
            fieldErrors={fieldErrors}
          />
        </div>
      ) : null}
    </div>
  );
}
