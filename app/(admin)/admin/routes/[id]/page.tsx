/**
 * `/admin/routes/[id]` — dynamic Server Component that renders the admin
 * metadata edit form for a single route. SSRs the current row + the
 * project-wide tag dictionary, then hands both to the client island
 * `<EditPageClient>` which owns the form state and Server Action wiring.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"/admin/routes/[id] renders the metadata edit form" (line 41)
 *        - Scenario "Admin opens edit page for existing route" → 200 + SSR
 *          fetch by id + render edit form
 *        - Scenario "Edit page for unknown id returns 404" → `notFound()`
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §4.3
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 03
 *        (`screenshots/03-routes-edit.png`) — breadcrumb + 「編輯路線 · {title}」
 *        hero + two-column form/GPX-derived card; all heavy lifting is in
 *        `<EditPageClient>` from §3.8, so this page is a thin SSR shell.
 *
 * Next 15 async params: `params` is a `Promise<{ id: string }>` and must be
 * awaited before the dynamic segment can be read. Typing it as the Next 14
 * sync `{ id: string }` object would fail `pnpm typecheck` under Next 15.
 *
 * Auth: the `(admin)` segment is gated by `middleware.ts` (Wave C) which
 * rejects unauthenticated visitors and non-admin users before this Server
 * Component runs — so we can call `getDb()` directly without re-checking
 * the session here.
 *
 * Why a full-row `select()` (no column projection)?
 *   The sibling `/admin/routes` index (§4.2) projects only 7 columns because
 *   the list view never needs `geojson`. The edit page is different: the
 *   right-hand READ-ONLY card in `<EditPageClient>` derives 軌跡點數
 *   (`countTrackpoints`) from `initial.geojson`, plus 距離 / 累積爬升 /
 *   紀錄時間 / gpx_path from the full row. The form itself reads
 *   `description`, `region`, `tags`, `durationS`, `difficulty`, `published`,
 *   etc. Almost every column is consumed, so projection would save nothing
 *   and risk silently dropping a field the form depends on later.
 *
 * `Promise.all` over the route lookup and `listExistingTags(db)` avoids a
 * sequential waterfall — both queries are independent and run in parallel
 * against the same Drizzle client.
 *
 * 0-row handling: Drizzle's `.limit(1)` returns `Route[]` of length 0 when
 * the id has no match. `notFound()` from `next/navigation` throws an
 * internal Next.js error that renders the 404 page, satisfying the spec's
 * "Edit page for unknown id returns 404" scenario.
 */
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { EditPageClient } from "@/features/admin-routes/EditPageClient";
import { listExistingTags } from "@/lib/admin-routes/listExistingTags";
import { getDb } from "@/lib/db/client";
import { routes } from "@/lib/db/schema";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditRoutePage({ params }: Props) {
  const { id } = await params;
  const db = getDb();

  const [routeRows, existingTags] = await Promise.all([
    db.select().from(routes).where(eq(routes.id, id)).limit(1),
    listExistingTags(db),
  ]);

  if (routeRows.length === 0) {
    notFound();
  }

  // Safe after the length check above; the `!` satisfies tsconfig's
  // `noUncheckedIndexedAccess` rule without an extra runtime guard.
  const route = routeRows[0]!;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <EditPageClient initial={route} existingTags={existingTags} />
    </section>
  );
}
