---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

# Tasks: bootstrap-yuki-running-map

> 本 change 的範圍是「**不被外部服務阻塞**的專案骨架」：repo + tooling、design system、map/GPX libraries、public placeholder pages、docs、GitHub Actions。所有 Supabase / GitHub OAuth / Vercel / middleware / admin pages / E2E 全部移到後續 change `wave-c-supabase-rls-auth`，待 Yuki 依 `docs/runbooks/deploy.md` 完成外部設定後再實作。原 4 個功能頁的真實邏輯則拆為更後續的 changes。

## 1. Repo & Tooling
- [x] 1.1 Scaffold Next.js 15 (App Router) + TypeScript strict + pnpm
  - Acceptance: WHEN run `pnpm install && pnpm dev` THEN dev server 啟動於 localhost:3000、root 路由回 200、TS `strict` 與 `noUncheckedIndexedAccess` 開啟、package manager 鎖定為 pnpm（packageManager 欄位 + `.npmrc`）
  - Depends on: -
  - Independence: serial
  - status: passing
- [x] 1.2 Set up ESLint flat config + Prettier + Tailwind plugin
  - Acceptance: WHEN run `pnpm lint` 與 `pnpm format:check` THEN 對乾淨的 scaffold 0 errors、Tailwind class 自動排序、import 順序由 ESLint plugin enforce
  - Depends on: 1.1
  - Independence: serial
  - status: passing
- [x] 1.3 Add `.env.example` listing all required env vars
  - Acceptance: WHEN 開啟 `.env.example` THEN 列出 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_GITHUB_USERNAME`、`NEXT_PUBLIC_PMTILES_URL` 與用途註解、`.gitignore` 排除 `.env.local`
  - Depends on: 1.1
  - Independence: parallel-safe
  - status: passing

## 2. Design system foundation
- [x] 2.1 Configure Tailwind CSS v4 with `@theme` design token slots in `app/globals.css`
  - Acceptance: WHEN 開啟 `globals.css` THEN 內含 design.md §6 所列所有 token slot（color/typography/spacing/radius/shadow/motion）但具體值留空或填 placeholder neutral 值、tailwind 設定編譯通過
  - Depends on: 1.2
  - Independence: serial
  - status: passing
- [x] 2.2 Install shadcn/ui base primitives (button / input / card / dialog / dropdown-menu / tabs / sonner)
  - Acceptance: WHEN 引入這些 component 到任意頁面 THEN render 成功、Lucide icons 可用、Radix peer deps 正確安裝
  - Depends on: 2.1
  - Independence: serial
  - status: passing
- [x] 2.3 Create `(public)` 與 `(admin)` route groups with shared layouts
  - Acceptance: WHEN 訪客存取 `(public)` 任一頁 THEN 顯示 public layout（含 header/footer placeholder）；WHEN admin 存取 `(admin)` 任一頁 THEN 顯示 admin layout（含 sign-out 按鈕 placeholder）、兩個 layout 共用 root layout 的 fonts + globals.css
  - Depends on: 2.2
  - Independence: serial
  - status: passing

## 5. Map & GPX libraries (skeletons + units)
- [x] 5.1 Create `lib/map/` PMTiles loader + MapLibre style helper
  - Acceptance: WHEN Client Component 呼叫 `createMap(container, { center, zoom })` THEN 載入 PMTiles 並繪出底圖、style 從 `lib/map/style.ts` 匯出常數
  - Depends on: 1.1
  - Independence: parallel-safe
  - status: passing
- [x] 5.2 Implement `lib/gpx/` parse + simplify + metadata extraction
  - Acceptance: WHEN 餵給 `parseGpx(buffer)` 一個 fixture GPX THEN 回 `{ geojson, distanceM, elevationGainM, bbox, startPoint, recordedAt }`；WHEN `simplifyLineString(coords, tolerance=0.0001)` THEN 回傳點數介於 100–500、首尾點不變；Vitest 覆蓋率對 `lib/gpx/*` ≥ 80%
  - Depends on: 1.1
  - Independence: parallel-safe
  - status: passing
- [x] 5.3 Write `docs/runbooks/pmtiles-update.md`
  - Acceptance: WHEN 開啟此 runbook THEN 包含「打包範圍（台灣 + 常去國家）」「使用 `pmtiles extract` 指令」「上傳到 Supabase Storage 的 path 慣例」「更新 `NEXT_PUBLIC_PMTILES_URL` 流程」
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

## 6. Placeholder pages
- [x] 6.1 `/` (public home) placeholder with hero + 「精選路線」section skeleton
  - Acceptance: WHEN 訪客 GET `/` THEN 返回 200、`<h1>` 含 "Yuki's Running Map"、含「瀏覽路線」CTA 連到 `/routes`
  - Depends on: 2.3
  - Independence: parallel-safe
  - status: passing
- [x] 6.2 `/routes` (route list) placeholder shell
  - Acceptance: WHEN 訪客 GET `/routes` THEN 返回 200、含左欄篩選 region 與 toolbar placeholder、含「目前無路線」empty state、不發 DB query
  - Depends on: 2.3
  - Independence: parallel-safe
  - status: passing
- [x] 6.3 `/routes/[slug]` (route detail) placeholder
  - Acceptance: WHEN 訪客 GET `/routes/example-route` THEN 返回 200 並顯示「Coming soon」placeholder；WHEN 訪客 GET `/routes/unknown` THEN 同樣返回 200 placeholder（真實 not_found 邏輯留待後續 change）
  - Depends on: 2.3
  - Independence: parallel-safe
  - status: passing

## 7. Documentation
- [x] 7.1 Write `CLAUDE.md` (Claude Code entry point)
  - Acceptance: WHEN 開啟 `CLAUDE.md` THEN 含一句話專案描述、顯眼提示「Read AGENTS.md before editing」、常用指令清單（dev/test/lint/db migrate/pmtiles update）、「不要做的事」清單、連結到 `AGENTS.md` `openspec/project.md` `docs/architecture.md`
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.2 Write `AGENTS.md`
  - Acceptance: WHEN 開啟 `AGENTS.md` THEN 含 design.md §7「AGENTS.md 內容綱要」所有條目：對話/code 語言規則、tech stack 一覽（指向 `docs/architecture.md`）、code style（TS strict、禁 any）、folder boundaries、testing 規範、Conventional Commits、PR/openspec 對應、env vars 清單
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.3 Write `openspec/project.md` (north star)
  - Acceptance: WHEN 開啟 THEN 含專案宗旨「個人跑步路線分享網站」、stakeholders（Yuki = owner + admin、訪客 = read-only）、long-term goals、non-goals（無評論/會員系統、無付費）
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.4 Write `docs/architecture.md`
  - Acceptance: WHEN 開啟 THEN 含 design.md §3 架構圖（ASCII 或 mermaid）、邊界說明（Edge vs Node、`features/*` 不互 import、`lib/*` 共用）
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.5 Write `docs/data-model.md`
  - Acceptance: WHEN 開啟 THEN 含 `routes` table 完整 schema、每個 index 的用途、「為何同時存 geojson 與 gpx_path」、「地圖搜尋 SQL 範例」、RLS policy 摘要
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.6 Write `docs/runbooks/local-dev.md`
  - Acceptance: WHEN 新 contributor 照著做 THEN 從 clone 到 `pnpm dev` 全部可成功；含 Supabase local emulator（或共用 dev 專案）說明、env 設定步驟、`pnpm db:migrate` 流程
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 7.7 Write `docs/runbooks/deploy.md`
  - Acceptance: WHEN 開啟 THEN 含 Vercel 專案連結步驟、env vars 設定清單、Supabase OAuth callback URL 對應、PMTiles bucket 設定、首次 deploy checklist
  - Depends on: 3.1, 3.2
  - Independence: parallel-safe
  - status: passing
  - Note: 寫於 Wave C 之前，故同時擔任 Wave C onboarding runbook（Yuki 照著做 Supabase + OAuth + Vercel 設定）
- [x] 7.8 Write `README.md`
  - Acceptance: WHEN 開啟 THEN 一段專案介紹、live URL placeholder、tech stack badge、quickstart 指向 `docs/runbooks/local-dev.md`、authorship。不重複 CLAUDE.md/AGENTS.md 內容
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

## 8. CI & deployment
- [x] 8.1 Set up GitHub Actions: lint + typecheck + test on PR
  - Acceptance: WHEN PR 開啟 THEN `lint`、`typecheck`、`test` 三個 job 並行跑、任一失敗 PR 顯示紅 X、main 分支需綠燈才能 merge（branch protection 由 owner 後續設定，本 task 只交付 workflow 檔）
  - Depends on: 1.2, 5.2
  - Independence: serial
  - status: passing

## 9. Logo & favicon placeholder
- [x] 9.1 Add placeholder Logo SVG + wordmark in `public/brand/`
  - Acceptance: WHEN 存取 `/brand/logo.svg` THEN 取得 placeholder SVG（暫用 monogram 「Y」）、CLAUDE.md 註明「待 writing-figma 階段以使用者選定版本替換」
  - Depends on: -
  - Independence: parallel-safe
  - status: passing
- [x] 9.2 Add placeholder `favicon.ico` + `app/icon.tsx` + `app/apple-icon.tsx`
  - Acceptance: WHEN browser 載入任一頁 THEN 顯示 placeholder favicon、無 404 console error
  - Depends on: -
  - Independence: parallel-safe
  - status: passing

## Optional artifacts
- [x] PlantUML diagrams:
  - [01-component-system-architecture.puml](./diagrams/01-component-system-architecture.puml) — 系統架構（Next.js / Supabase / Protomaps / GitHub OAuth 邊界與 runtime 切分）
  - _ER diagram deferred — 待功能頁面實作 change 時再規劃 `routes` schema 視覺化_
- [x] Figma designs (spec-driven-dev:writing-figma) — required: 3 version design system (V1 Topo Minimal / V2 Trail Vintage / V3 Sport Mono) + Logo set (4 variants per version: light/dark/mono/favicon)
