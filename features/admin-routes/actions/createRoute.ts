"use server";

/**
 * `createRoute` Server Action (Node runtime).
 *
 * Orchestrates the full create-route flow per
 * `openspec/changes/feat-admin-gpx-upload/diagrams/01-sequence-create-route.puml`:
 *
 *   1. Validate metadata via `validateRouteMetadata` (client-supplied fields
 *      only — title / slug / description / region / tags / difficulty /
 *      duration_s / published). Fail closed: any field error returns
 *      `{ ok: false, fieldErrors }` BEFORE any I/O.
 *   2. Read the uploaded `gpxFile` `File` from the FormData and server-side
 *      `parseGpx(buffer)` it. Client metadata is NEVER trusted for
 *      GPX-derived columns (distance, elevation, bbox, start point, geojson,
 *      recorded_at) — these come exclusively from the server parse result.
 *   3. Generate a `randomUUID()` and derive the Storage object path
 *      `gpx/{yyyy}/{uuid}.gpx` (UTC year for cross-machine stability).
 *   4. Upload the buffer to the `gpx` bucket via the Supabase JS client. The
 *      JS path is mandatory here because the buffer goes through Supabase
 *      Storage, whose RLS depends on the admin JWT carried by the JS client.
 *   5. INSERT a single `routes` row via Drizzle. On ANY exception between
 *      Storage upload and INSERT completion, invoke
 *      `storage.from('gpx').remove([path])` to rollback the orphaned object
 *      (best-effort; a rollback failure is logged but the original INSERT
 *      error is what the caller sees).
 *   6. On full success only, call `revalidatePath('/routes')`,
 *      `revalidatePath('/routes/' + slug)`, and
 *      `revalidatePath('/admin/routes')` to flush Next.js caches.
 *   7. Return `{ ok: true, id, slug }` to the client.
 *
 * Trust boundary: this Action runs on the Node runtime behind the admin
 * `middleware.ts` guard (Wave C). It catches every error at the trust
 * boundary and folds it into the discriminated return type — the Action
 * SHALL NEVER throw across the client boundary. Drizzle bypasses Supabase
 * RLS on the `routes` table; the middleware gate is the actual security
 * boundary for this code path.
 *
 * Error message strings (繁體中文) are taken verbatim from the spec
 * (`openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md`
 * §createRoute Server Action) and surface directly in the admin UI.
 */

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { derivePathFromUuid } from "@/lib/admin-routes/gpxFile";
import { validateRouteMetadata } from "@/lib/admin-routes/validation";
import { getDb } from "@/lib/db/client";
import { isPgUniqueViolation } from "@/lib/db/errors";
import { routes } from "@/lib/db/schema";
import { parseGpx } from "@/lib/gpx/parse";
import { createServerClient } from "@/lib/supabase/server";

export type CreateRouteResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; fieldErrors: Record<string, string> };

const STORAGE_BUCKET = "gpx";
const ROUTES_SLUG_UNIQUE = "routes_slug_unique";

/**
 * Coerce a single FormData entry that may be a string, File, or absent into
 * the trimmed string we want. Returns `null` when the entry is a File or
 * undefined.
 */
function formString(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  return raw;
}

/**
 * Parse the FormData payload into the structured metadata object that
 * `validateRouteMetadata` expects. The tags arrive as a JSON-stringified
 * array (the client serialises a `string[]` because FormData has no native
 * array type); `duration_s` arrives as a numeric string; `published` arrives
 * as the literal `'true'` / `'false'`.
 */
function parseMetadataFromFormData(formData: FormData): unknown {
  const title = formString(formData, "title") ?? "";
  const slug = formString(formData, "slug") ?? "";
  const description = formString(formData, "description");
  const region = formString(formData, "region");
  const difficulty = formString(formData, "difficulty") ?? "";
  const publishedRaw = formString(formData, "published");
  const durationRaw = formString(formData, "duration_s");
  const tagsRaw = formString(formData, "tags");

  let tags: unknown = [];
  if (tagsRaw !== null && tagsRaw.length > 0) {
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      // Defer to validateRouteMetadata which will surface
      // `fieldErrors.tags = '標籤格式不正確'` for a non-array value.
      tags = null;
    }
  }

  let durationS: number | null = null;
  if (durationRaw !== null && durationRaw.length > 0) {
    const n = Number(durationRaw);
    // Pass through whatever we got; validateRouteMetadata is the gatekeeper.
    durationS = Number.isFinite(n) ? n : Number.NaN;
  }

  return {
    title,
    slug,
    description,
    region,
    tags,
    difficulty,
    duration_s: durationS,
    published: publishedRaw === "true",
  };
}

export async function createRoute(formData: FormData): Promise<CreateRouteResult> {
  // ── ① Validate metadata FIRST — fail before any I/O ─────────────────────
  const metadata = parseMetadataFromFormData(formData);
  const validation = validateRouteMetadata(metadata);
  if (!validation.ok) {
    return { ok: false, fieldErrors: validation.fieldErrors };
  }
  const meta = validation.value;

  // ── Pull the GPX File from FormData ─────────────────────────────────────
  // `File extends Blob` in both DOM and Node runtimes, so a single `Blob`
  // check covers both the browser-FormData-File case and any server-side
  // Blob the form-action plumbing might hand us.
  const gpxEntry = formData.get("gpxFile");
  if (!(gpxEntry instanceof Blob)) {
    return { ok: false, fieldErrors: { gpxFile: "請選 .gpx 檔" } };
  }
  const buffer = Buffer.from(await gpxEntry.arrayBuffer());

  // ── ② Server-side parse — buffer is the source of truth for GPX columns ─
  let gpx;
  try {
    gpx = parseGpx(buffer);
  } catch {
    return {
      ok: false,
      fieldErrors: { gpxFile: "GPX 解析失敗（無有效軌跡點？）" },
    };
  }

  // ── ③ Derive uuid + Storage path ────────────────────────────────────────
  const id = randomUUID();
  const path = derivePathFromUuid(new Date(), id);

  // ── ④ Storage upload ────────────────────────────────────────────────────
  const supabase = await createServerClient();
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, {
        contentType: "application/gpx+xml",
        upsert: false,
      });
    if (error) {
      // Supabase JS surfaces Storage failures via the error field (not throw).
      return {
        ok: false,
        fieldErrors: { _form: "Storage 上傳失敗，請重試" },
      };
    }
  } catch {
    return {
      ok: false,
      fieldErrors: { _form: "Storage 上傳失敗，請重試" },
    };
  }

  // ── ⑤ INSERT routes row (Drizzle; rollback Storage on any throw) ────────
  let insertedId: string;
  let insertedSlug: string;
  try {
    const db = getDb();
    const rows = await db
      .insert(routes)
      .values({
        id,
        slug: meta.slug,
        title: meta.title,
        description: meta.description,
        distanceM: Math.round(gpx.distanceM),
        elevationGainM: Math.round(gpx.elevationGainM),
        durationS: meta.durationS,
        recordedAt: gpx.recordedAt,
        region: meta.region,
        tags: meta.tags,
        difficulty: meta.difficulty,
        gpxPath: path,
        geojson: gpx.geojson,
        // PostGIS geometry columns expect GeoJSON Polygon/Point — the
        // `geometryPolygon4326` / `geometryPoint4326` customTypes round-trip
        // these via the driver.
        bbox: {
          type: "Polygon",
          coordinates: [
            [
              [gpx.bbox[0], gpx.bbox[1]],
              [gpx.bbox[2], gpx.bbox[1]],
              [gpx.bbox[2], gpx.bbox[3]],
              [gpx.bbox[0], gpx.bbox[3]],
              [gpx.bbox[0], gpx.bbox[1]],
            ],
          ],
        },
        startPoint: {
          type: "Point",
          coordinates: [gpx.startPoint[0], gpx.startPoint[1]],
        },
        published: meta.published,
      })
      .returning({ id: routes.id, slug: routes.slug });

    const inserted = rows[0];
    if (!inserted) {
      // Treat empty returning() as a generic INSERT failure and rollback.
      await rollbackStorage(supabase, path);
      console.error("createRoute: INSERT returning() produced no rows");
      return {
        ok: false,
        fieldErrors: { _form: "寫入失敗：INSERT 未回傳新列" },
      };
    }
    insertedId = inserted.id;
    insertedSlug = inserted.slug;
  } catch (e) {
    // Rollback the orphaned Storage object first.
    await rollbackStorage(supabase, path);

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

  // ── ⑥ Revalidate Next.js caches — happy path only ───────────────────────
  revalidatePath("/routes");
  revalidatePath("/routes/" + insertedSlug);
  revalidatePath("/admin/routes");

  // ── ⑦ Return success ────────────────────────────────────────────────────
  return { ok: true, id: insertedId, slug: insertedSlug };
}

/**
 * Best-effort Storage rollback. A failure here means we leave an orphan GPX
 * file in the bucket — annoying but not catastrophic. We log a warning so a
 * human operator can sweep it later, but we never surface the rollback
 * failure to the caller (the original INSERT error is what they need to see).
 */
async function rollbackStorage(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  path: string,
): Promise<void> {
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (rollbackError) {
    console.warn("createRoute: Storage rollback failed", path, rollbackError);
  }
}
