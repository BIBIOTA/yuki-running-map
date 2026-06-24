"use server";

/**
 * `previewRegions` Server Action — read-only spatial-preview helper for
 * the admin upload flow.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/route-administrative-regions/spec.md
 *       Requirement "previewRegions read-only Server Action returns Region[] from a LineString"
 *
 * The Action takes the simplified LineString geometry that
 * `parseGpx(buffer).geojson.geometry` returns, calls the shared
 * `detectRegions` helper to obtain matching `admin_units.id` values, and
 * SELECTs the corresponding rows from `admin_units` to assemble `Region[]`.
 *
 * Trust boundary: this Action runs behind the existing admin
 * `middleware.ts` guard. It does NOT write anything and does NOT call
 * `revalidatePath`. Every error path is folded into the discriminated
 * return type — the Action SHALL NEVER throw across the client boundary
 * (failed previews must not block the user's submit; the canonical
 * `detectRegions` call inside `createRoute` is the source of truth).
 */

import { inArray } from "drizzle-orm";

import { detectRegions } from "@/lib/admin-routes/detectRegions";
import { getDb } from "@/lib/db/client";
import { adminUnits } from "@/lib/db/schema";
import type { Region } from "@/lib/regions/types";

export type PreviewRegionsInput = {
  type: "LineString";
  coordinates: Array<[number, number]>;
};

export type PreviewRegionsResult =
  | { ok: true; regions: Region[] }
  | { ok: false; message: string };

function isValidLineString(input: unknown): input is PreviewRegionsInput {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  if (obj.type !== "LineString") return false;
  if (!Array.isArray(obj.coordinates) || obj.coordinates.length < 2) return false;
  for (const pt of obj.coordinates) {
    if (!Array.isArray(pt) || pt.length !== 2) return false;
    if (typeof pt[0] !== "number" || typeof pt[1] !== "number") return false;
  }
  return true;
}

export async function previewRegions(
  geometry: PreviewRegionsInput,
): Promise<PreviewRegionsResult> {
  if (!isValidLineString(geometry)) {
    return { ok: false, message: "預覽參數錯誤" };
  }

  try {
    const db = getDb();
    const ids = await detectRegions(db, geometry);
    if (ids.length === 0) {
      return { ok: true, regions: [] };
    }
    const rows = await db
      .select({
        code: adminUnits.code,
        level: adminUnits.level,
        name: adminUnits.name,
        parent_code: adminUnits.parentCode,
      })
      .from(adminUnits)
      .where(inArray(adminUnits.id, ids));
    return { ok: true, regions: rows };
  } catch (e) {
    console.error("previewRegions failed", e);
    return { ok: false, message: "行政區預覽暫時無法使用" };
  }
}
