---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

# Design: Bootstrap Yuki's Running Map

## 1. 目的與範圍

### 目的
建立 **Yuki's Running Map**（個人跑步路線分享網站）的專案骨架。本次 change 只涵蓋「bootstrap」層級：技術選型、目錄結構、設計系統 token 骨架、Logo 規劃方向、Claude Code 文件結構（CLAUDE.md / AGENTS.md / openspec / docs）。

### Out of scope
- 4 個功能頁（路線列表、路線詳情、Admin Login、Admin Upload）的實作 — 每頁將以獨立的後續 change 進行。
- 實際 Logo 與最終配色定稿 — 將於 `spec-driven-dev:writing-figma` 階段以 3 個 Figma variant 並陳，使用者選定後再寫回 tokens。
- 內容遷移、SEO 文案、analytics 整合、i18n。

### 成功條件
1. `pnpm install && pnpm dev` 可啟動空殼網站（root 頁 + 4 個頁面 placeholder route）。
2. Supabase 專案、PostGIS extension、Storage bucket、GitHub OAuth provider 全部設定完成且 documented。
3. CLAUDE.md / AGENTS.md / openspec/project.md / docs/* 結構完備，未來每個 PR 可對應一個 openspec change。
4. Design tokens 結構就位（具體色值與 Logo 由 Figma 階段補上）。
5. CI（Vercel preview deployment + GitHub Actions lint/test）綠燈。

---

## 2. 技術選型

### 整體 stack（方案 A：Supabase 一站式）

| 層 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js 15 (App Router) + TypeScript strict | Vercel 原生、SSR/ISR 對 SEO 友善、Server Actions 適合上傳流程 |
| Runtime split | Edge for 讀取、Node for GPX 解析 | GPX 解析需 Node stream |
| Package manager | pnpm | 安裝快、Vercel 與 monorepo 友善 |
| DB | Supabase Postgres + PostGIS extension | PostGIS 對地圖 bbox 查詢是天然解法 |
| ORM | Drizzle ORM | TS-first、輕量、可定義 PostGIS custom column types |
| 物件儲存 | Supabase Storage | 與 DB 同帳號、RLS policy 管寫入 |
| Auth | Supabase Auth (GitHub OAuth provider) | 一行設定、與 RLS 整合 |
| 地圖渲染 | MapLibre GL JS | 開源、無 vendor lock |
| 地圖瓦片 | Protomaps PMTiles（自託管於 Supabase Storage 或 R2） | 免費、單檔、零 vendor 依賴 |
| UI 樣式 | Tailwind CSS v4 + `@theme` design tokens | 可雙向同步 Figma variables |
| Component primitive | shadcn/ui + Radix Primitives | 可控、accessibility 內建 |
| Icons | Lucide React | 與 shadcn 對齊、tree-shake 友善 |
| 表單/驗證 | React Hook Form + Zod | 上傳頁型別安全 |
| GPX 解析 | `@tmcw/togeojson` + `gpx-parse`（server side） | 抽 distance / elevation / bbox / 簡化軌跡 |
| 海拔 chart | Recharts 或 `visx` | 詳情頁 elevation profile |
| 測試 | Vitest（unit） + Playwright（E2E） | 4 個 user flow 為 E2E 主要對象 |
| Lint/Format | ESLint flat config + Prettier | flat config 與 Tailwind plugin 共存 |
| CI | GitHub Actions（lint/test）+ Vercel Preview | PR-driven |

### 為何不選方案 B（Neon + R2 + Auth.js）
要管 3 個外部帳號（Neon / R2 / GitHub OAuth App），上傳流程要自寫 R2 signed URL；Supabase 將 DB/Storage/Auth 整合在同一個 dashboard，個人站使用情境下純粹是 ergonomics 勝出。日後若 vendor lock 成問題，Drizzle + 標準 Postgres + S3-相容 API 可以平移到 B 方案。

### 為何不選方案 C（Astro + Git 工作流）
偏離原始需求（管理員登入 + 上傳頁）。

---

## 3. 系統架構

```
┌──────────────────────────────────────────────────────────┐
│ Vercel                                                   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Next.js 15 App Router                                │ │
│ │  ├─ (public) layout                                  │ │
│ │  │   ├─ /            首頁（Hero + 精選路線）         │ │
│ │  │   ├─ /routes      路線列表                        │ │
│ │  │   └─ /routes/[slug]  路線詳情                     │ │
│ │  └─ (admin) layout (middleware-protected)            │ │
│ │      ├─ /admin/login                                 │ │
│ │      └─ /admin/upload                                │ │
│ └──────────────────────────────────────────────────────┘ │
└───────────────┬───────────────────┬──────────────────────┘
                │                   │
        Server Actions /     fetch tiles
        Route Handlers              │
                │                   ▼
                ▼            ┌─────────────┐
        ┌──────────────┐    │ Protomaps   │
        │  Supabase    │    │ PMTiles     │
        │  ├ Postgres  │    │ (Storage)   │
        │  │  +PostGIS │    └─────────────┘
        │  ├ Storage   │  ← GPX 原檔
        │  └ Auth      │  ← GitHub OAuth
        └──────────────┘
```

### 關鍵原則
- **Route group 邊界**：`(public)` 與 `(admin)` 兩個 layout group。`(admin)` 由 `middleware.ts` 用 Supabase Auth helper 驗 session；session 中的 `user.user_metadata.user_name` 必須等於 `ADMIN_GITHUB_USERNAME` env 才放行，否則 redirect to `/admin/login`。
- **Server Components default**：列表頁 SSR + ISR（5 分鐘 revalidate）給 SEO；地圖互動部分為 Client Component。
- **Feature folder**：`features/routes`、`features/admin`、`lib/supabase`、`lib/map`、`lib/gpx`。**Features 之間不互相 import**；共用邏輯下沉到 `lib/`。
- **Runtime split**：簡單讀取走 Edge runtime；上傳頁的 Server Action 走 Node runtime。

---

## 4. 資料模型

### `routes` table（Drizzle schema 草案）

```ts
id              uuid pk default gen_random_uuid()
slug            text unique not null         -- 'tamsui-river-15k'
title           text not null
description     text                          -- markdown
distance_m      int not null                  -- 公尺
elevation_gain_m int not null                 -- 累積爬升
duration_s      int                           -- 紀錄當下時間（可選）
recorded_at     timestamptz not null
location_name   text                          -- 「淡水河左岸」
region          text                          -- 「台北」「東京」用來篩選
tags            text[] default '{}'           -- ['河濱','LSD','夜跑']
difficulty      enum('easy','medium','hard') not null
gpx_path        text not null                 -- Storage object path
geojson         jsonb not null                -- 簡化後的 LineString，給列表 thumbnail
bbox            geometry(Polygon, 4326) not null    -- PostGIS：給地圖框選搜尋
start_point     geometry(Point, 4326) not null      -- 給「距我最近」排序
cover_image     text
published       boolean not null default false
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

### Index
- `GIST(bbox)`：viewport 框選查詢
- `GIST(start_point)`：「距我最近」排序
- `btree(recorded_at desc)`：列表預設排序
- `GIN(tags)`：tag 篩選
- `btree(slug)`：unique constraint 已附帶

### 為何同時存 `geojson` 與 `gpx_path`
列表頁需要批次畫 N 條軌跡縮圖，不該每張縮圖都從 Storage 拉原始 GPX 解析。`geojson` 是簡化後（容差 0.0001°，約 100–500 點）的 LineString，足夠列表縮圖。詳情頁才會去 Storage 拉原檔做高精度渲染。

### 地圖搜尋運作方式
前端傳 viewport `minLng,minLat,maxLng,maxLat`，後端執行：
```sql
SELECT * FROM routes
WHERE published = true
  AND ST_Intersects(bbox, ST_MakeEnvelope($1,$2,$3,$4, 4326));
```

### Supabase RLS policy 概要
- `routes` SELECT：任何人，但限 `published = true`
- `routes` INSERT/UPDATE/DELETE：限 `auth.jwt()->user_metadata->>user_name = ADMIN_GITHUB_USERNAME`
- `storage.objects` bucket=`gpx`：read public, write admin-only（同上判斷）

---

## 5. 4 個功能頁概覽

> 注意：本 change 只建立 **placeholder routes + empty components**，實際功能由後續 change 實作。下表是高階契約描述，供寫 tasks 與 spec 時參考。

### 5.1 路線列表 `/routes`
- 左欄篩選：keyword（title/location_name ILIKE）、region、tag（multi，PostGIS `&&`）、difficulty、distance range、elevation range
- 排序：最新（預設）/ 距離 / 爬升 / 距我最近（需瀏覽器定位授權）
- 分頁：cursor-based（`recorded_at + id`），每頁 12 筆
- 地圖模式 toggle：右側 split view 顯示 MapLibre 地圖；移動地圖 → debounce 500ms → 重抓 bbox 內路線；左欄同步只顯示 viewport 命中項
- URL 狀態：所有篩選/排序/page 同步進 query string（SSR 友善 + 可分享）

### 5.2 路線詳情 `/routes/[slug]`
- 上：標題 + 統計 chips（距離 / 爬升 / 日期 / 區域）
- 中：MapLibre 全寬地圖（軌跡 + 起終點 marker + elevation profile chart）
- 下：描述 markdown + 標籤 + 「下載 GPX」按鈕（Supabase Storage signed URL，TTL 24h）
- SEO：`generateMetadata` 寫 OG image（路線縮圖）+ JSON-LD `SportsActivityLocation`

### 5.3 管理員登入 `/admin/login`
- 「以 GitHub 登入」單一按鈕 → Supabase OAuth flow
- callback 後檢查 `user.user_metadata.user_name === ADMIN_GITHUB_USERNAME`，不符立即 `signOut()` 並顯示「未授權」
- middleware 守護 `(admin)/*`

### 5.4 管理員上傳 `/admin/upload`
- Drag & drop GPX → 即時 client-side 預覽（解析、畫地圖、顯示推算 metadata）
- 表單欄位：title / description / region / tags / difficulty / cover_image / published 開關
- 送出時 Server Action：
  1. 上傳原檔到 Storage `gpx/{yyyy}/{uuid}.gpx`
  2. server 端二次解析（信任邊界，client 解析只是 UX）→ 算 bbox / start_point / 簡化軌跡
  3. INSERT into routes
  4. `revalidatePath('/routes')` + `revalidatePath(/routes/${slug})`

---

## 6. UI 設計系統

> **選定方向：V2 Trail Vintage**（2026-06-09 由 Yuki 決定，三版並陳於 Figma 後挑選）。完整 Figma 探索記錄見 [./designs/figma.md](./designs/figma.md)。

### Design tokens（Tailwind v4 `@theme` + CSS variables）

```css
@theme {
  /* — Color tokens · V2 Trail Vintage — */
  --color-bg:            #F8F1E0;  /* 米黃 */
  --color-surface:       #FFFAEC;  /* 米白 */
  --color-surface-muted: #ECE0C4;
  --color-border:        #D9C9A4;
  --color-fg:            #2A1F12;  /* 深咖 */
  --color-fg-muted:      #6B5638;
  --color-brand:         #2F5D3A;  /* 森綠 */
  --color-brand-fg:      #FFFFFF;
  --color-accent:        #C26A3D;  /* 鏽橘 */
  --color-route-line:    #C26A3D;
  --color-route-line-glow: rgb(194 106 61 / 0.4);
  --color-elevation:     #BFA77A;
  --color-success:       #4E8D5A;
  --color-warning:       #C28A3D;
  --color-danger:        #A6473D;

  /* — Typography — */
  --font-display:        "Fraunces", "Noto Serif TC", Georgia, serif;
  --font-sans:           "Inter", "Noto Sans TC", system-ui, sans-serif;
  --font-mono:           "IBM Plex Mono", ui-monospace, "JetBrains Mono", monospace;

  /* fluid type scale via clamp() — 實際值在 globals.css 給出 */
  --text-xs / --text-sm / --text-base / --text-lg / --text-xl / --text-2xl / --text-3xl

  /* — Spacing scale — 4px base */
  --space-1 ... --space-12

  /* — Radius — */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  16px;
  --radius-pill: 999px;

  /* — Shadow — */
  --shadow-card / --shadow-popover / --shadow-map

  /* — Motion — */
  --ease-out-soft / --ease-spring
  --dur-quick / --dur-base / --dur-slow
}
```

### 視覺方向

- **Mood**：溫暖、手繪感、跡跡感、跑道與山林的復古地誌
- **Logo 方向**：跑者剪影 + 跑道弧線（已於 Figma mockup 實作）
- **Wordmark**：Fraunces 為主；hero / favicon 等關鍵點綴可考慮加入手寫元素（見 [./designs/figma.md](./designs/figma.md) Open Question #4）
- **Logo variants**：Light / Dark / Monochrome / Favicon 各一

### 決策歷史

V1 Topo Minimal（冷調極簡）與 V3 Sport Mono（高對比運動）皆已於同一個 Figma file 內保留，作為決策痕跡參考，不再作為實作備選方案。

---

## 7. 目錄結構

```
run-map/
├─ CLAUDE.md                      # Claude Code 入口；指向 AGENTS.md
├─ AGENTS.md                      # 開發 conventions
├─ README.md                      # 給 GitHub 訪客
├─ openspec/
│  ├─ project.md                  # 整個專案 north star
│  └─ changes/
│     └─ bootstrap-yuki-running-map/
│        ├─ design.md             # 本檔
│        ├─ tasks.md              # writing-plans 產出
│        ├─ proposal.md           # writing-spec 產出
│        ├─ specs/                # writing-spec 產出（capability spec.md）
│        ├─ diagrams/             # writing-uml 產出（.puml）
│        └─ designs/figma.md      # writing-figma 產出
├─ docs/
│  ├─ architecture.md             # 長期 architecture（從 design.md 拆出）
│  ├─ data-model.md
│  └─ runbooks/
│     ├─ local-dev.md
│     ├─ deploy.md
│     └─ pmtiles-update.md        # 如何更新地圖瓦片
├─ app/                           # Next.js App Router
│  ├─ (public)/
│  │  ├─ page.tsx                 # 首頁
│  │  ├─ routes/page.tsx
│  │  └─ routes/[slug]/page.tsx
│  ├─ (admin)/
│  │  ├─ admin/login/page.tsx
│  │  └─ admin/upload/page.tsx
│  ├─ layout.tsx
│  └─ globals.css                 # @theme tokens
├─ features/
│  ├─ routes/                     # 列表 + 詳情
│  └─ admin/                      # 登入 + 上傳
├─ lib/
│  ├─ supabase/                   # client / server / middleware helpers
│  ├─ db/                         # drizzle schema + migrations
│  ├─ map/                        # MapLibre helpers, PMTiles loader
│  └─ gpx/                        # parse / simplify / metadata
├─ components/ui/                 # shadcn primitives
├─ middleware.ts                  # admin route guard
├─ public/                        # logos / og-default
└─ ...
```

### CLAUDE.md 內容綱要
- 一句話：「Yuki's Running Map — 個人跑步路線分享網站」
- **顯眼提示：「Read AGENTS.md before editing」**
- 常用指令（dev / test / lint / db migrate / pmtiles update）
- 不要做的事：不寫無人請求的 README、不引入新 dependency 不先問
- 連結：`openspec/project.md`、`docs/architecture.md`

### AGENTS.md 內容綱要
- 語言：對話繁中、code/identifier/commit/spec keyword 英文
- Tech stack 一覽（指向 `docs/architecture.md`）
- Code style：TS strict / 禁用 `any` / Server Component default / 命名規則
- Folder boundaries：`features/*` 不互相 import；共用走 `lib/*`
- Testing：Vitest 寫 lib 純函式；Playwright 寫 4 個關鍵 user flow
- Commit：Conventional Commits
- PR：每個 PR 對應一個 openspec change
- Secrets：`.env.local` 永不 commit；列出需要的 env vars（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_GITHUB_USERNAME`, `NEXT_PUBLIC_PMTILES_URL`）

### openspec/project.md
- 專案宗旨、stakeholders、long-term goals、non-goals

---

## 8. Error Handling

| 場景 | 處理 |
|---|---|
| 上傳的 GPX 解析失敗（壞檔/非 GPX） | Server Action 回 typed error，UI inline 顯示「無法解析此 GPX 檔」 |
| GPX 過大（>10MB） | 上傳前 client size check + server hard limit |
| 地圖瓦片 fetch 失敗 | MapLibre `error` event → toast 「地圖載入失敗，請重新整理」 |
| 非 admin 使用者進入 `/admin/*` | middleware redirect to `/admin/login?from=...` |
| Admin 登入但 GitHub username 不是 ADMIN_GITHUB_USERNAME | callback 立即 `signOut()` + 顯示「未授權」靜態頁 |
| Supabase 連線中斷 | Next.js error boundary 顯示 friendly 錯誤 + 「重試」 |
| 路線 slug 不存在 | `notFound()` → custom 404 |

---

## 9. Testing 策略

| 層 | 工具 | 範圍 |
|---|---|---|
| Unit | Vitest | `lib/gpx`（parse / simplify / bbox 計算）、`lib/map` helpers、Drizzle schema validators |
| Integration | Vitest + Supabase local | RLS policy 行為、PostGIS 查詢結果 |
| E2E | Playwright | 4 個 user flow：訪客瀏覽列表、訪客看詳情並下載 GPX、admin 登入、admin 上傳 GPX |
| 視覺迴歸 | Playwright trace + screenshot diff（可選） | 三個 Figma version 落地後啟用 |

**本 change 的測試底線**：placeholder 頁面有 smoke test（200 OK + 標題存在）；CI pipeline 跑通。功能測試在後續 change 中各自補上。

---

## 10. Probable Next Steps

| Skill | 用途 | 是否需要 |
|---|---|---|
| `spec-driven-dev:writing-plans` | 把本 design.md 拆成 tasks.md | 必要 |
| `spec-driven-dev:writing-uml` | 畫 (a) 上傳流程 sequence、(b) `(admin)` middleware 流程、(c) PostGIS 地圖搜尋資料流 | 建議 |
| `spec-driven-dev:writing-figma` | 產 3 版 design library + Logo，使用者選定後再回填 tokens | **必要** |
| `spec-driven-dev:writing-spec` | 把 design 轉為 ADDED Requirements + Scenarios | 必要 |
| `spec-driven-dev:test-driven-development` | 實作：Scenario → 失敗測試 → 最小實作 | 實作階段 |

---

## 11. Open Questions / 後續確認

下列問題不阻擋本 change 進入 tasks，但實作前需確認：

1. **ADMIN_GITHUB_USERNAME 具體值**：寫入 Vercel env 時需要 Yuki 的 GitHub username。
2. **Protomaps PMTiles 範圍**：全球瓦片約 100+GB；初期建議僅打包「使用者跑步活動覆蓋區域」（台灣 + 常去國家），約 1–5GB。寫 `docs/runbooks/pmtiles-update.md` 時定義打包腳本。
3. **GPX 上傳大小上限**：建議 10MB（涵蓋多日 ultra），需確認。
4. **路線「published=false」的草稿狀態**：admin 是否需要單獨「草稿列表」？本 change 預設「先存 unpublished，待 admin 在詳情頁 toggle published」，相關 UI 留到實作 change 決定。
5. **每個路線是否需要多張圖片**：目前只設一張 `cover_image`。若要相簿，需新增 `route_images` table。

---

## 12. Diagrams

- [Component: System Architecture](./diagrams/01-component-system-architecture.puml) — 系統架構：Vercel/Next.js（含 Edge vs Node runtime 切分、`(public)` 與 `(admin)` route groups、middleware、Server Actions、Client Components）、Supabase（Postgres + PostGIS、Storage 的 `gpx` 與 `tiles` bucket、Auth）、GitHub OAuth、訪客與管理員流向。對應 §3 系統架構文字描述。

> Database ER diagram 暫不在 bootstrap 範圍內，待功能頁面實作 change 啟動時再規劃。`routes` table 的欄位、index、RLS 設計仍以 §4 文字描述為準。

---

## 13. Designs

- [Figma Designs](./designs/figma.md) — Yuki's Running Map · Design System file（[Figma 連結](https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc)）。三版 mockup 並陳，已於 2026-06-09 選定 **V2 Trail Vintage** 為實作方向。圖檔含色票、Typography、Logo 4 variants、Components、Header/Footer，並附 4 張 screenshot 於 [./designs/screenshots/](./designs/screenshots/)。
