/**
 * `/admin/routes/[id]` — dynamic Server Component that renders the admin
 * metadata edit form for a single route. SSRs the current row + the
 * joined admin_units regions, then hands them to `<EditPageClient>` which
 * owns the form state and Server Action wiring.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/admin-routes-crud/spec.md
 *       MODIFIED Requirement "/admin/routes/[id] renders the metadata edit form"
 *
 * Next 15 async params: `params` is a `Promise<{ id: string }>` and must be
 * awaited before the dynamic segment can be read.
 *
 * Auth: the `(admin)` segment is gated by `middleware.ts` (Wave C) which
 * rejects unauthenticated visitors and non-admin users before this Server
 * Component runs — so we can call `getDb()` directly without re-checking
 * the session here.
 *
 * 0-row handling: Drizzle's `.limit(1)` returns `Route[]` of length 0 when
 * the id has no match. `notFound()` from `next/navigation` throws an
 * internal Next.js error that renders the 404 page, satisfying the spec's
 * "Edit page for unknown id returns 404" scenario.
 */
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { EditPageClient } from "@/features/admin-routes/EditPageClient";
import { getDb } from "@/lib/db/client";
import { adminUnits, routeAdminUnits, routes } from "@/lib/db/schema";
import type { Region } from "@/lib/regions/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditRoutePage({ params }: Props) {
  const { id } = await params;
  const db = getDb();

  const routeRows = await db
    .select()
    .from(routes)
    .where(eq(routes.id, id))
    .limit(1);

  if (routeRows.length === 0) {
    notFound();
  }

  // Safe after the length check above; the `!` satisfies tsconfig's
  // `noUncheckedIndexedAccess` rule without an extra runtime guard.
  const route = routeRows[0]!;

  // LeftJoin admin_units for the shared RouteRegionsSection chrome.
  const joinedRegions = await db
    .select({
      code: adminUnits.code,
      level: adminUnits.level,
      name: adminUnits.name,
      parentCode: adminUnits.parentCode,
    })
    .from(routeAdminUnits)
    .innerJoin(adminUnits, eq(adminUnits.id, routeAdminUnits.adminUnitId))
    .where(eq(routeAdminUnits.routeId, route.id));
  const routeRegions: Region[] = joinedRegions.map((r) => ({
    code: r.code,
    level: r.level,
    name: r.name,
    parent_code: r.parentCode,
  }));

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <EditPageClient initial={route} routeRegions={routeRegions} />
    </section>
  );
}
