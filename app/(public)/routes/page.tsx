import { and, asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { MapPinned } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/db/client";
import { adminUnits, routeAdminUnits, routes } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "路線",
  description: "Yuki 的跑步路線列表 — 搜尋、排序、地圖瀏覽。",
};

interface CountyFilter {
  code: string;
  name: string;
  count: number;
}

/**
 * Pulls every county that has at least one published route intersecting it.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-administrative-regions/spec.md
 *       Requirement "Public /routes list filter is dynamic from admin_units"
 */
async function loadCountyFilters(): Promise<CountyFilter[]> {
  const db = getDb();
  const rows = await db
    .select({
      code: adminUnits.code,
      name: adminUnits.name,
      count: count(routes.id),
    })
    .from(adminUnits)
    .innerJoin(routeAdminUnits, eq(routeAdminUnits.adminUnitId, adminUnits.id))
    .innerJoin(routes, eq(routes.id, routeAdminUnits.routeId))
    .where(and(eq(adminUnits.level, "county"), eq(routes.published, true)))
    .groupBy(adminUnits.code, adminUnits.name)
    .orderBy(asc(adminUnits.code));
  return rows;
}

export default async function RoutesListPage() {
  const counties = await loadCountyFilters();

  return (
    <section className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-12">
      <aside aria-label="filters" className="sticky top-6 hidden w-64 shrink-0 space-y-6 lg:block">
        <div className="space-y-2">
          <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            搜尋
          </h2>
          <Input placeholder="路線名稱、地點、標籤…" disabled aria-disabled="true" />
        </div>
        <div className="space-y-2">
          <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            區域
          </h2>
          {counties.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-1 px-3 py-3 text-center text-xs">
                <p className="font-medium text-foreground">目前沒有可篩選的縣市</p>
                <p className="text-muted-foreground">
                  等 admin 上傳並 publish 第一條路線後出現
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="region-filters">
              {counties.map((county) => (
                <li key={county.code} className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
                  <span className="text-foreground">{county.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{county.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex-1 space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">路線列表</h1>
            <p className="text-sm text-muted-foreground">搜尋、排序、地圖瀏覽 — 功能還在組裝中。</p>
          </div>
          <div className="font-mono text-xs text-muted-foreground">0 routes</div>
        </header>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MapPinned className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-base text-foreground">目前無路線</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Yuki 還沒上傳任何路線。等待管理員上傳功能完成後，這裡將出現可瀏覽、可下載的跑步路線。
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

