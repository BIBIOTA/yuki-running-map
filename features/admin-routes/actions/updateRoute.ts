"use server";

/**
 * `updateRoute` Server Action (Node runtime).
 *
 * Mutates metadata-only columns on an existing `routes` row. Per
 * `openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md`
 * §updateRoute (lines 100–120) and the `elseif (update)` branch of
 * `openspec/changes/feat-admin-gpx-upload/diagrams/03-activity-action-result-handling.puml`:
 *
 *   1. Silently strip any GPX-derived keys the client may have sent
 *      (`gpx_path` / `geojson` / `bbox` / `start_point` / `distance_m` /
 *      `elevation_gain_m` / `recorded_at` / `id` / `created_at`). These
 *      columns are derived server-side from the GPX file during `createRoute`
 *      and MUST NOT be re-set from the client. Stripping is silent — no
 *      `fieldErrors` — because the form may innocently echo the row back.
 *   2. Validate the remaining (allow-listed) keys via `validateRouteMetadata`.
 *      Fail closed: any field error returns `{ ok: false, fieldErrors }`
 *      BEFORE any I/O.
 *   3. `SELECT slug FROM routes WHERE id = $1` to obtain `oldSlug`. We need
 *      this to revalidate the previous slug's public route path when the slug
 *      changes (the cached `/routes/{oldSlug}` segment would otherwise stay
 *      live until natural expiry).
 *   4. `UPDATE routes SET ...metaOnly, updated_at = now() WHERE id = $1` via
 *      Drizzle. The UPDATE bypasses Supabase RLS (Drizzle connects with the
 *      service-role-equivalent role in `DATABASE_URL`); the actual auth
 *      boundary is the admin `middleware.ts` (Wave C).
 *   5. On success, `revalidatePath('/routes')`,
 *      `revalidatePath('/routes/' + oldSlug)`,
 *      `revalidatePath('/routes/' + newSlug)` (only when different from old),
 *      and `revalidatePath('/admin/routes')`. Order chosen for parity with
 *      `createRoute`.
 *   6. Return `{ ok: true }`. The Action SHALL NEVER throw across the client
 *      boundary — every error path folds into the discriminated union.
 *
 * Error mapping (繁體中文 strings surface directly in the admin UI):
 *
 *   - Slug UNIQUE violation → `fieldErrors.slug = '此 slug 已被使用'`
 *   - Zero rows from the SELECT (no route with that id) → treated as a write
 *     failure: `fieldErrors._form = '找不到路線'`. The spec does not
 *     explicitly cover this case; documenting the choice here for reviewers.
 *     The alternative (returning `{ ok: true }`) would let the UI claim a
 *     successful save when nothing was written, which is worse than a clear
 *     error string.
 *   - Any other throw → `console.error(e)` + `fieldErrors._form = '寫入失敗：...'`
 *     (matching `createRoute`'s generic-error string).
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { validateRouteMetadata } from "@/lib/admin-routes/validation";
import { getDb } from "@/lib/db/client";
import { isPgUniqueViolation } from "@/lib/db/errors";
import { routes } from "@/lib/db/schema";

export type UpdateRouteResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string> };

const ROUTES_SLUG_UNIQUE = "routes_slug_unique";

/**
 * Allow-list of keys the client may set via `updateRoute`. Mirrors the field
 * set accepted by `validateRouteMetadata`. Anything else on `input` is
 * dropped silently before validation.
 *
 * Locked (stripped) keys per spec.md:100: `gpx_path`, `geojson`, `bbox`,
 * `start_point`, `distance_m`, `elevation_gain_m`, `recorded_at`, `id`,
 * `created_at`.
 */
const METADATA_KEYS = [
  "title",
  "slug",
  "description",
  "region",
  "tags",
  "difficulty",
  "duration_s",
  "published",
] as const;

type MetadataKey = (typeof METADATA_KEYS)[number];

/**
 * Build a plain object that contains only the allow-listed metadata keys from
 * the caller's input. Any other property — including the nine GPX-derived
 * locked keys called out in the spec — is silently dropped.
 */
function stripToMetadataOnly(
  input: Record<string, unknown>,
): Partial<Record<MetadataKey, unknown>> {
  const out: Partial<Record<MetadataKey, unknown>> = {};
  for (const key of METADATA_KEYS) {
    if (key in input) {
      out[key] = input[key];
    }
  }
  return out;
}

export async function updateRoute(
  input: { id: string; [key: string]: unknown },
): Promise<UpdateRouteResult> {
  // ── ① Strip locked keys (silent) ────────────────────────────────────────
  const metaOnly = stripToMetadataOnly(input);

  // ── ② Validate metadata FIRST — fail before any I/O ─────────────────────
  const validation = validateRouteMetadata(metaOnly);
  if (!validation.ok) {
    return { ok: false, fieldErrors: validation.fieldErrors };
  }
  const meta = validation.value;

  try {
    const db = getDb();

    // ── ③ Look up `oldSlug` so we can revalidate the previous public path ─
    const existing = await db
      .select({ slug: routes.slug })
      .from(routes)
      .where(eq(routes.id, input.id))
      .limit(1);

    const oldRow = existing[0];
    if (!oldRow) {
      // Documented decision: 0-rows is treated as a write failure rather than
      // silently passing. See file header.
      return {
        ok: false,
        fieldErrors: { _form: "找不到路線" },
      };
    }
    const oldSlug = oldRow.slug;

    // ── ④ UPDATE the metadata columns + updated_at ──────────────────────────
    await db
      .update(routes)
      .set({
        title: meta.title,
        slug: meta.slug,
        description: meta.description,
        region: meta.region,
        tags: meta.tags,
        difficulty: meta.difficulty,
        durationS: meta.durationS,
        published: meta.published,
        updatedAt: new Date(),
      })
      .where(eq(routes.id, input.id));

    // ── ⑤ Revalidate Next.js caches — happy path only ─────────────────────
    const newSlug = meta.slug;
    revalidatePath("/routes");
    revalidatePath("/routes/" + oldSlug);
    if (newSlug !== oldSlug) {
      revalidatePath("/routes/" + newSlug);
    }
    revalidatePath("/admin/routes");

    // ── ⑥ Return success ─────────────────────────────────────────────────
    return { ok: true };
  } catch (e) {
    if (isPgUniqueViolation(e, ROUTES_SLUG_UNIQUE)) {
      return {
        ok: false,
        fieldErrors: { slug: "此 slug 已被使用" },
      };
    }
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      fieldErrors: { _form: `寫入失敗：${message}` },
    };
  }
}
