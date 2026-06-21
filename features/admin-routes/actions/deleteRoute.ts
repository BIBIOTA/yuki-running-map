"use server";

/**
 * `deleteRoute` Server Action (Node runtime).
 *
 * Hard-deletes a `routes` row and best-effort cleans up the matching GPX
 * object in Supabase Storage. Per
 * `openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md`
 * §deleteRoute (lines 122–150) and
 * `openspec/changes/feat-admin-gpx-upload/diagrams/02-sequence-delete-route.puml`:
 *
 *   1. `SELECT gpx_path, slug FROM routes WHERE id = $1` (LIMIT 1). Slug is
 *      pulled alongside `gpx_path` because the diagram's step ④ requires
 *      `revalidatePath('/routes/' + slug)` and we can no longer read the row
 *      after the DELETE.
 *   2. Zero rows → return `{ ok: true }` (idempotent). Protects against the
 *      race where another tab already deleted the row.
 *   3. `DELETE FROM routes WHERE id = $1` via Drizzle. On throw → return
 *      `{ ok: false, message: '刪除失敗' }` and SKIP both Storage cleanup AND
 *      `revalidatePath` (the row is still there, nothing changed for the cache
 *      to invalidate).
 *   4. `storage.from('gpx').remove([gpx_path])` — best-effort. Either path of
 *      failure (the SDK returning `{ error }` OR throwing) is swallowed with
 *      `console.warn('orphan gpx file', path, e)` and the Action still returns
 *      `{ ok: true }`. Rationale (per spec.md:122 and the diagram's
 *      `note over Action, Storage`): the row is already gone, so the
 *      `gpx_public_select_published` Storage policy's `EXISTS` clause no
 *      longer resolves and the object is effectively unreachable to anon
 *      readers. An orphan file is annoying but not a security issue.
 *   5. `revalidatePath('/routes')`, `revalidatePath('/routes/' + slug)`, and
 *      `revalidatePath('/admin/routes')` fire ONLY when the row was actually
 *      removed — i.e. on success OR on a logged-orphan path, never on a DB
 *      DELETE throw.
 *
 * Trust boundary: like `createRoute` / `updateRoute`, this Action sits behind
 * the admin `middleware.ts` guard (Wave C). It catches every error and folds
 * it into the discriminated `{ ok: true } | { ok: false, message }` return.
 * The Action SHALL NEVER throw across the client boundary.
 *
 * The 繁體中文 error string `'刪除失敗'` is taken verbatim from the spec and
 * surfaces directly in the admin UI's sonner toast.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db/client";
import { routes } from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";

export type DeleteRouteResult = { ok: true } | { ok: false; message: string };

const STORAGE_BUCKET = "gpx";

/**
 * Strip the `gpx/` prefix from `routes.gpx_path` to get the bucket-relative
 * key the Supabase Storage SDK expects. See `createRoute.ts` for the full
 * rationale — same bug source: DB stores `gpx/{yyyy}/{uuid}.gpx`, SDK wants
 * `{yyyy}/{uuid}.gpx`.
 */
function bucketRelativeKey(path: string): string {
  return path.startsWith(`${STORAGE_BUCKET}/`)
    ? path.slice(STORAGE_BUCKET.length + 1)
    : path;
}

export async function deleteRoute(input: {
  id: string;
}): Promise<DeleteRouteResult> {
  const db = getDb();

  // ── ① SELECT gpx_path + slug (slug is needed for the post-delete revalidate
  //      since the row is gone by then) ─────────────────────────────────────
  const rows = await db
    .select({ gpxPath: routes.gpxPath, slug: routes.slug })
    .from(routes)
    .where(eq(routes.id, input.id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Idempotent: nothing to delete, nothing to revalidate.
    return { ok: true };
  }
  const { gpxPath, slug } = row;

  // ── ② DELETE the row first; Storage cleanup is best-effort downstream ────
  try {
    await db.delete(routes).where(eq(routes.id, input.id));
  } catch (e) {
    console.error(e);
    return { ok: false, message: "刪除失敗" };
  }

  // ── ③ Best-effort Storage remove. Either an SDK throw or a returned
  //      `{ error }` is logged as an orphan and swallowed. The row is gone,
  //      so we still report success and still revalidate. ─────────────────
  const supabase = await createServerClient();
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([bucketRelativeKey(gpxPath)]);
    if (error) {
      console.warn("orphan gpx file", gpxPath, error);
    }
  } catch (e) {
    console.warn("orphan gpx file", gpxPath, e);
  }

  // ── ④ Revalidate Next.js caches — happy path AND orphan-warned path ────
  revalidatePath("/routes");
  revalidatePath("/routes/" + slug);
  revalidatePath("/admin/routes");

  return { ok: true };
}
