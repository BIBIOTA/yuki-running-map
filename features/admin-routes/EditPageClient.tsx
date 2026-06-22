"use client";

/**
 * `<EditPageClient>` — the composition root for the admin
 * `/admin/routes/[id]` edit flow. Renders the breadcrumb + hero, owns
 * the `updateRoute` Server Action round-trip on submit, and lays out
 * a two-column grid: the editable `<RouteMetadataForm>` on the left
 * and the READ-ONLY GPX-derived card on the right (Figma frame 03).
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"/admin/routes/[id] renders the metadata edit form" (line 41)
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §3.8
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 03
 *        - `screenshots/03-routes-edit.png` — breadcrumb
 *          「路線管理 / 編輯」, hero 「編輯路線 · {title}」, left col
 *          edit form, right col READ-ONLY card titled
 *          「GPX 衍生（鎖定）」 with mono `<dl>` rows for 距離 / 累積爬升 /
 *          軌跡點數 / 紀錄時間 / gpx_path; action row right-aligned
 *          with outline 「取消」 + brand 「儲存」.
 *
 * Server Action wiring (deliberate trade-offs, mirrored from §3.7):
 *
 *   - `useTransition` is NOT used here. `<RouteMetadataForm>` already
 *     manages its own `submitting` state via `await onSubmit(values)`
 *     — the button disables itself for the duration of the awaited
 *     promise. Adding `useTransition` on top would duplicate the
 *     disable signal and complicate result handling because
 *     `startTransition`'s callback return value is discarded.
 *     Precedent: `UploadPageClient.tsx` (task 3.7) made the same call
 *     for the create flow.
 *   - On `{ ok: true }` the user stays on the page (no navigation) and
 *     a sonner `toast.success('已儲存')` confirms the write. The form's
 *     internal state is preserved so the user can continue editing.
 *   - On `{ ok: false, fieldErrors }` the errors are forwarded to the
 *     form via the `fieldErrors` prop; the form renders the `_form`
 *     Alert and per-field red text.
 *
 * Read-only card derivation:
 *
 *   - `initial.distanceM` / `initial.elevationGainM`: rendered via the
 *     local `formatDistance` / `formatElevation` helpers (km with 2
 *     decimals; integer metres).
 *   - `initial.geojson`: typed as `unknown` from Drizzle's `jsonb`;
 *     `countTrackpoints` narrows defensively. Falls back to 0 on any
 *     unexpected shape rather than throwing.
 *   - `initial.recordedAt`: rendered via `formatRecordedAt`
 *     (UTC YYYY-MM-DD) — same helper the routes list table uses, so
 *     the same date appears identically in both views.
 *   - `initial.gpxPath`: rendered as-is in a mono <dd>; break-all
 *     because Supabase paths can be long.
 *
 * Testability note: the React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./editPageState.ts` and
 * are covered by `__tests__/editPageState.test.ts`; the full
 * user-visible behaviour (submit → ok → toast | submit → error →
 * field errors) is exercised by the admin edit Playwright spec
 * (task 5.2).
 */

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { updateRoute } from "@/features/admin-routes/actions/updateRoute";
import type { Route } from "@/lib/db/schema";

import {
  buildFormInitialFromRoute,
  buildUpdateRoutePayload,
  countTrackpoints,
  formatDistance,
  formatElevation,
} from "./editPageState";
import { formatRecordedAt } from "./routeListView";
import { RouteMetadataForm } from "./RouteMetadataForm";
import type { RouteMetadataValues } from "./types";
import type { Region } from "@/lib/regions/types";

type Props = {
  initial: Route;
  existingTags: string[];
  /**
   * Detected admin_units for this route, joined server-side by the page
   * (task 3.13). Rendered read-only inside `<RouteMetadataForm>`.
   */
  routeRegions?: Region[];
};

export function EditPageClient({ initial, existingTags, routeRegions }: Props) {
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string> | undefined
  >(undefined);

  async function handleSubmit(values: RouteMetadataValues): Promise<void> {
    setFieldErrors(undefined);
    const payload = buildUpdateRoutePayload(initial.id, values);
    const result = await updateRoute(payload);
    if (result.ok) {
      toast.success("已儲存");
    } else {
      setFieldErrors(result.fieldErrors);
    }
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/admin/routes" className="hover:underline">
          路線管理
        </Link>
        <span> / </span>
        <span>編輯</span>
      </nav>
      <h1 className="font-display text-3xl font-semibold">
        編輯路線 · {initial.title}
      </h1>
      <div className="grid gap-6 md:grid-cols-2">
        <RouteMetadataForm
          mode="edit"
          existingTags={existingTags}
          onSubmit={handleSubmit}
          initial={buildFormInitialFromRoute(initial)}
          fieldErrors={fieldErrors}
          cancelHref="/admin/routes"
          routeRegions={routeRegions}
        />
        <aside className="space-y-4 rounded-md border border-border bg-muted/30 p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            GPX 衍生（鎖定）
            <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 text-xs">
              READ-ONLY
            </span>
          </h2>
          <dl className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">距離</dt>
              <dd>{formatDistance(initial.distanceM)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">累積爬升</dt>
              <dd>{formatElevation(initial.elevationGainM)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">軌跡點數</dt>
              <dd>{countTrackpoints(initial.geojson)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">紀錄時間</dt>
              <dd>{formatRecordedAt(initial.recordedAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">gpx_path</dt>
              <dd className="break-all text-xs">{initial.gpxPath}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
