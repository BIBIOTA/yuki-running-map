/**
 * `<RouteList>` — Server Component that renders the admin 路線管理 table.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        openspec/changes/feat-admin-gpx-upload/tasks.md §3.6
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md
 *        - `screenshots/02-routes-happy.png` — 6-col table
 *          標題 / Slug / 區域 / 狀態 / 紀錄日 / 操作 with
 *          ● 已發佈 (brand bg) / ● 草稿 (muted) chips and per-row
 *          `編輯 · 刪除` actions.
 *        - `screenshots/04-routes-empty.png` — dashed-border centred
 *          card with folder icon + 「尚無路線」 display + 副標
 *          + brand 「+ 新增路線」 CTA → `/admin/upload`.
 *
 * Why a native `<table>` instead of `components/ui/table`: shadcn's
 * Table primitive is itself a styled wrapper over the native
 * `<table>` family (Radix ships no Table primitive — it would be
 * pointless because the native element already exposes the right
 * semantics). The project's `components/ui` directory deliberately
 * does NOT include a Table file, and per CLAUDE.md we do NOT add new
 * deps without approval. We therefore hand-roll the table using the
 * same Trail Vintage Tailwind aliases (`bg-muted/50`, `border-border`,
 * `text-muted-foreground`, `text-primary`) that the rest of the admin
 * surface already uses — visually and semantically identical to the
 * shadcn output for this use-case.
 *
 * Server Component (NO `"use client"`): the row data is fetched in the
 * parent route Server Component and passed in via props. Only the
 * inner `<DeleteRouteButton>` is a Client Component, and it ships its
 * own `"use client"` boundary; embedding it here is legal under the
 * React Server Components composition rules.
 *
 * Testability note: pure helpers (status classification, recorded_at
 * formatting, edit-path building) live in `./routeListView.ts` and are
 * covered by `__tests__/routeListView.test.ts`. The table DOM (column
 * order, draft chip rendering, edit-link routing, empty-state CTA) is
 * exercised end-to-end by the admin Playwright spec (task 5.1).
 *
 * 繁體中文 strings are load-bearing — they are quoted verbatim by the
 * task acceptance criteria and matched by the Playwright selectors.
 * Do NOT translate or paraphrase without re-running spec validation.
 */
import { FolderIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Route } from "@/lib/db/schema";

import { DeleteRouteButton } from "./DeleteRouteButton";
import { buildEditPath, classifyStatus, formatRecordedAt } from "./routeListView";

type Props = {
  routes: Route[];
};

export function RouteList({ routes }: Props) {
  if (routes.length === 0) {
    return (
      <div
        role="region"
        aria-label="空路線列表"
        className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center"
      >
        <FolderIcon className="size-12 text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-medium">尚無路線</p>
        <p className="text-sm text-muted-foreground">請至 /admin/upload 新增第一條路線。</p>
        <Button asChild>
          <Link href="/admin/upload">+ 新增路線</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              標題
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Slug
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              區域
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              狀態
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              紀錄日
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const status = classifyStatus(route.published);
            return (
              <tr key={route.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <span>{route.title}</span>
                  {status.kind === "draft" ? (
                    <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      草稿
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{route.slug}</td>
                <td className="px-4 py-3">{route.region ?? "—"}</td>
                <td className="px-4 py-3">
                  {status.kind === "published" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      ● 已發佈
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      ● 草稿
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatRecordedAt(route.recordedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={buildEditPath(route.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      編輯
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <DeleteRouteButton
                      id={route.id}
                      title={route.title}
                      gpxPath={route.gpxPath}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
