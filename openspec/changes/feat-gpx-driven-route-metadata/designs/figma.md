---
change_id: feat-gpx-driven-route-metadata
doc_language: zh-TW
---

# Figma Designs: feat-gpx-driven-route-metadata

## Figma File

- File: <https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc>
- File key: `Yx9G0efBQq3amHPEyeVSDc`
- File name: **Yuki's Running Map · Design System**（沿用 bootstrap 既有 file）
- Page: **`feat-gpx-driven-route-metadata`**（新建）
- Page node id: `70:2`

## Versions

單一 v1（UX 在 brainstorm + design 階段已收斂，不做 A/B 比較）。

## Scope

本批 wireframe 涵蓋三個交付主軸：
- **公開 detail 頁 layout**（含 ElevationProfile 區塊 + RouteRegions 區塊）— 兩個狀態（happy / empty）。
- **RouteRegions 三 surface 對照**（admin form / public detail / admin list）。
- **公開列表頁 RegionFilter 動態狀態**（N counties / 0 published）。
- **Admin upload chip area loading skeleton**（Server Action transaction 過渡）。

沿用 V2 Trail Vintage hardcoded tokens：
- 米黃 `#F8F1E0`（背景） / 米黃深 `#EEE3CB`（chip / map placeholder）
- 森綠 `#2F5D3A`（primary） / 鏽橘 `#C26A3D`（accent / elevation curve）
- 墨黑 `#222222`（ink） / 灰褐 `#6E6655`（muted）
- Fraunces（display, SemiBold）· Inter（body, Regular / Medium / "Semi Bold"）· IBM Plex Mono（label / spec note, Regular / Medium）

> **約束**：colour / typography 在 Figma 內為 hardcoded 值，**不新建** Figma Component / Variants / Variables；與 [`archive/2026-06-16-bootstrap-yuki-running-map/designs/figma.md` § Out of scope](../../archive/2026-06-16-bootstrap-yuki-running-map/designs/figma.md) 列的「Figma Variables / Components 留待後續 library change」一致。RouteRegions / ElevationProfile / RegionFilter 是「視覺 spec」frames 而非 Figma object — 實作時直接 hand-write SVG / Tailwind。

## Frames

| # | State | Frame name | Frame node | Screenshot |
|---|---|---|---|---|
| 01 | Happy | `01 · /routes/[slug] (happy · elevation + chips)` | `70:7` | [screenshots/01-detail-happy.png](./screenshots/01-detail-happy.png) |
| 02 | Empty | `02 · /routes/[slug] (empty · 無海拔 + 0 regions)` | `70:8` | [screenshots/02-detail-empty.png](./screenshots/02-detail-empty.png) |
| 03 | Read-only / Composite | `03 · RouteRegions · 三 surface 對照` | `70:9` | [screenshots/03-routeregions-trio.png](./screenshots/03-routeregions-trio.png) |
| 04 | Happy / Empty | `04 · /routes (RegionFilter · 動態 / empty)` | `70:10` | [screenshots/04-regionfilter-states.png](./screenshots/04-regionfilter-states.png) |
| 05 | Loading | `05 · /admin/upload (chip area · loading)` | `70:11` | [screenshots/05-upload-loading-skeleton.png](./screenshots/05-upload-loading-skeleton.png) |

## Shared components used

所有元件以 shadcn/ui primitive 直譯 + V2 tokens 配色；**不新建** Figma component。對應實作元件：

| Frame 元素 | 視覺 spec | 實作元件 |
|---|---|---|
| 路線標題 / 章節標題 | Fraunces SemiBold | hand-write `<h1>` / `<h2>` + Tailwind `font-display` |
| 描述 body / chip label | Inter Regular / Medium | shadcn `<p>` / hand-write `<span>` |
| spec note / eyebrow / data-testid 註記 | IBM Plex Mono Regular / Medium，letter-spacing 1–2px | hand-write `<span class="font-mono uppercase tracking-widest text-muted-foreground">` |
| 下載 GPX button | 森綠底 / 白字 / 圓角 8 | shadcn `<Button>`（default variant，配色靠 globals.css 的 `--primary`） |
| 統計 chip（距離 / 爬升 / 起跑時間）| 米黃深底 / 圓角 10 / 上 mono label 下 Fraunces value + Inter unit | hand-write `<dl>` + Tailwind |
| Stat 數值 | Fraunces SemiBold 22px / 森綠 | hand-write `<dd>` |
| RouteRegions 文字行（單個縣市區塊） | 一行 `{縣市} — {鄉鎮1、鄉鎮2…}`；縣市以 Inter Medium + 森綠 `#2F5D3A` 強調、鄉鎮以 Inter Regular + 墨黑、連字號 ` — ` 區隔；多縣市時逐行 stack。視覺等同段落，無 chip 元素。 | hand-write `<p>` × N（每縣市一行）|
| RouteRegions admin-list 壓縮行 | 單行 `{縣市} {鄉鎮1、鄉鎮2…} / {縣市} {鄉鎮…}`，CSS truncate（`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`），0 regions 顯示「—」 | hand-write `<span>` with truncate utility |
| ElevationProfile SVG | 白底 / 0.15 alpha 森綠 border / 鏽橘 path / mono 軸標籤 | `<svg>` server-rendered（見 design §4.2） |
| 「此路線無海拔資料」empty | 白底 / Fraunces title 18px + Inter hint + IBM Plex Mono `data-testid="elevation-empty"` 註記 | server component conditional render |
| RegionFilter list item | hover/active 用米黃深底 / 圓角 6 | hand-write `<li><button>` |
| RegionFilter 空狀態 | 米黃底 / 灰褐 虛線 border / 圓角 8 | hand-write `<div>` |
| Loading skeleton text-line | 米黃深填色 / 圓角 4 / 2 條（長 ~280px、短 ~120px）模擬「縣市 - 鄉鎮、鄉鎮 / 縣市 - 鄉鎮」 | hand-write `<span>` × 2 with shimmer keyframe |
| DETECTING… 徽章 | 森綠 0.12 alpha 底 / 森綠字 / mono / 圓角 999 | hand-write `<span>` |
| Read-only / Public / Overflow 徽章 | 灰褐 / 森綠 / 鏽橘 底 + 白字 + mono | spec annotation only — 實作時不需出現於 UI |

## Acceptance Criteria

實作必須符合以下視覺斷言（對應 tasks.md 內個別 task acceptance criteria）：

- **detail 頁 happy state**（task 2.8, 3.15）：實作 `/routes/[slug]` 須包含 hero（標題 + 副標 + 「← 路線列表」eyebrow）、3 個 stat chip、map 區塊、RouteRegions 區塊（≥ 1 region 時渲染、按 county group 後以「`{縣市} — {鄉鎮1、鄉鎮2…}`」格式逐行 stack，縣市字體略粗 + 森綠強調）、ElevationProfile SVG（含 `data-testid="elevation-profile"`、x/y 軸 mono 標籤）、描述、`<Button>下載 GPX`。視覺結構須對齊 frame `70:7`。
- **detail 頁 empty state**（task 2.7, 2.8, 3.15）：當 `elevation_profile = []` 時須顯示 `<p data-testid="elevation-empty">此路線無海拔資料</p>` 並隱藏 SVG；當 `regions = []` 時整段「途經區域」section（含標題）**不渲染**（return null）。視覺結構須對齊 frame `70:8`。
- **RouteRegions primitive**（task 3.9, 3.12, 3.14, 3.15）：須以單一 component 同時涵蓋三 surface — admin form（read-only 顯示，每縣市一行）、public detail（同樣每縣市一行）、admin list（單行 truncate `{縣市} {鄉鎮…} / {縣市} {鄉鎮…}`，0 regions 顯示「—」）。視覺須與 frame `70:9` 一致。component 以 paragraph-style 渲染（非 chip badge）。
- **RegionFilter 動態狀態**（task 3.16）：列表頁 region filter 須由 DB query 動態生成；0 published 時須顯示空狀態 box，**不**顯示 hardcoded 6 值（"台北" / "新北" / "宜蘭" / "陽明山" / "其他" / "全部"）。Active filter visual 須對齊 frame `70:10` 左欄、empty state 對齊右欄。
- **Admin upload loading skeleton**（task 3.13）：上傳 GPX 後到 Server Action 回傳前，chip area 須顯示 skeleton（2 條 text-line placeholder，模擬 2 行縣市行）+「DETECTING…」徽章；對齊 frame `70:11`。
- **Out of scope / Probable next steps**（design §10）：本案 frames **不**涵蓋 chart hover / tooltip、邊鎮 cascading filter、admin manual ± regions 等後續功能；對應 task 完工驗證不需這些 frame。

## Token reference

V2 Trail Vintage tokens 已 hardcoded 在 `app/globals.css`（與 `bootstrap-yuki-running-map` 既有定義一致）：

```css
--background: oklch(...);        /* 米黃 #F8F1E0 */
--primary:    oklch(...);        /* 森綠 #2F5D3A */
--accent:     oklch(...);        /* 鏽橘 #C26A3D */
--muted-foreground: oklch(...);  /* 灰褐 #6E6655 */
--font-display: "Fraunces", serif;
--font-sans:    "Inter", system-ui, sans-serif;
--font-mono:    "IBM Plex Mono", monospace;
```

實作時**不得**重 hardcode 色值；以 Tailwind utility（`bg-primary` / `text-muted-foreground` / `font-display` / 等）對應 token，與 frames 視覺對齊。
