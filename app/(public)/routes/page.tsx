import type { Metadata } from "next";

import { MapPinned } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "路線",
  description: "Yuki 的跑步路線列表 — 搜尋、排序、地圖瀏覽。",
};

const REGION_FILTERS = ["全部", "台北", "新北", "宜蘭", "陽明山", "其他"];

export default function RoutesListPage() {
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
          <ul className="space-y-1 text-sm">
            {REGION_FILTERS.map((region) => (
              <li key={region}>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md px-2 py-1 text-left text-muted-foreground transition-colors disabled:cursor-not-allowed"
                >
                  {region}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">路線列表</h1>
            <p className="text-sm text-muted-foreground">
              搜尋、排序、地圖瀏覽 — 功能還在組裝中。
            </p>
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
