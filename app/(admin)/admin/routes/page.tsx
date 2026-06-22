/**
 * `/admin/routes` — Server Component listing every route in the
 * database (including drafts) for the admin 路線管理 surface.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        openspec/changes/feat-admin-gpx-upload/tasks.md §4.2
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md
 *        - `screenshots/02-routes-happy.png` — hero 「路線管理」 +
 *          副標 `N 條 · X 已發佈 · Y 草稿` + 右上 brand CTA
 *          「+ 新增路線」 → `/admin/upload`. Below the hero is the
 *          shared `<RouteList>` (built in §3.6).
 *
 * Auth: the `(admin)` segment is gated by `middleware.ts` (Wave C)
 * which rejects unauthenticated visitors and non-admin users before
 * this Server Component runs — so we can call `getDb()` directly
 * without re-checking the session here.
 *
 * Ordering: `desc(routes.createdAt)` so newly-uploaded drafts appear
 * at the top of the table without any client-side sorting.
 *
 * Server Component (NO `"use client"`): the page is a thin shell —
 * fetch + summarise + render. The count helpers are extracted to
 * `features/admin-routes/routesPageSummary.ts` so they can be unit
 * tested without a live database.
 *
 * 繁體中文 strings 「路線管理」 / 「+ 新增路線」 are load-bearing.
 */
import { desc } from "drizzle-orm";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/client";
import { routes } from "@/lib/db/schema";

import { RouteList } from "@/features/admin-routes/RouteList";
import {
  buildSummaryText,
  summarizeRoutes,
} from "@/features/admin-routes/routesPageSummary";

export default async function AdminRoutesPage() {
  const db = getDb();
  // Explicit column projection: the `routes` table has a notNull `geojson`
  // jsonb column storing the full LineString payload, but the admin table
  // only ever reads id/title/slug/published/recordedAt/gpxPath. Selecting
  // `*` would drag every GeoJSON payload through Postgres → Node → React
  // serialisation and degrade as the route count grows, so we project only
  // the six columns `<RouteList>` (and the summary helper) actually consume.
  // The `regions` column is filled in task 3.17 via leftJoin on
  // route_admin_units × admin_units.
  const routesList = await db
    .select({
      id: routes.id,
      title: routes.title,
      slug: routes.slug,
      published: routes.published,
      recordedAt: routes.recordedAt,
      gpxPath: routes.gpxPath,
    })
    .from(routes)
    .orderBy(desc(routes.createdAt));
  const summary = summarizeRoutes(routesList);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">路線管理</h1>
          <p className="text-sm text-muted-foreground">{buildSummaryText(summary)}</p>
        </div>
        <Button asChild>
          <Link href="/admin/upload">+ 新增路線</Link>
        </Button>
      </div>
      <RouteList routes={routesList} />
    </section>
  );
}
