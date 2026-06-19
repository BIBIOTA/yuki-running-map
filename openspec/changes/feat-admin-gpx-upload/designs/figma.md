---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

# Figma Designs: feat-admin-gpx-upload

## Figma File

- File: <https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc>
- File key: `Yx9G0efBQq3amHPEyeVSDc`
- File name: **Yuki's Running Map · Design System**（沿用 bootstrap 既有 file）
- Page: **`Admin · feat-admin-gpx-upload`** (新建)
- Page node id: `58:2`

## Versions

單一 v1（UX 在 brainstorm 階段已收斂，不做 A/B 比較）。

## Scope

本批 wireframe 涵蓋三個 admin 頁面 + 一個 dropzone 狀態複合 frame + 一個確認對話框 overlay。沿用 V2 Trail Vintage tokens（米黃 `#F8F1E0` / 森綠 `#2F5D3A` / 鏽橘 `#C26A3D` / Fraunces + Inter + IBM Plex Mono）。**不新建** Figma Component / Variant / Variable — 維持 wireframe 等級；shadcn primitives 在 implementation 階段用 `components/ui/*` 直譯。

> **約束**：colour / typography 在 Figma 內為 hardcoded 值，與 `bootstrap-yuki-running-map/designs/figma.md §Out of scope` 列的「Figma Variables 留待後續 library change」一致。

## Frames

| # | State | Frame name | Frame node | Screenshot |
|---|---|---|---|---|
| 01 | Happy | `01 · /admin/upload (happy · dropzone empty)` | `58:3` | [screenshots/01-upload-happy.png](./screenshots/01-upload-happy.png) |
| 02 | Happy | `02 · /admin/routes (happy · 3 rows)` | `59:2` | [screenshots/02-routes-happy.png](./screenshots/02-routes-happy.png) |
| 03 | Happy | `03 · /admin/routes/[id] (edit · prefilled)` | `60:2` | [screenshots/03-routes-edit.png](./screenshots/03-routes-edit.png) |
| 04 | Empty | `04 · /admin/routes (empty state)` | `61:2` | [screenshots/04-routes-empty.png](./screenshots/04-routes-empty.png) |
| 05 | Error | `05 · /admin/upload (error · slug 重複 + _form Alert)` | `61:18` | [screenshots/05-upload-error.png](./screenshots/05-upload-error.png) |
| 06 | Composite | `06 · Dropzone states (empty · loaded · error)` | `62:2` | [screenshots/06-dropzone-states.png](./screenshots/06-dropzone-states.png) |
| 07 | Overlay | `07 · /admin/routes (confirm delete dialog overlay)` | `62:83` | [screenshots/07-delete-dialog.png](./screenshots/07-delete-dialog.png) |

## Shared components used

所有元件以 shadcn/ui primitive 直譯 + V2 tokens 配色；不新建 Figma component。對應實作元件：

| Figma 中的視覺 | Implementation primitive | 來源 |
|---|---|---|
| Top nav bar | `<AdminTopNav>` (本 change 改寫) + `<Button variant="ghost">` for links | 既有 `features/admin-auth/AdminTopNav.tsx` |
| Card 容器（表單外殼、metadata 卡） | `components/ui/card.tsx` | shadcn 既有 |
| Input field | `components/ui/input.tsx` | shadcn 既有 |
| Select（difficulty 下拉） | `components/ui/select.tsx` | **shadcn 新增**（implementation tasks 列入） |
| Table（routes 列表） | `components/ui/table.tsx` | **shadcn 新增** |
| Badge（已發佈 / 草稿 chip） | `components/ui/badge.tsx` | **shadcn 新增** |
| Switch（published toggle） | `components/ui/switch.tsx` | **shadcn 新增** |
| Alert（`_form` 錯誤條） | `components/ui/alert.tsx` | **shadcn 新增** |
| AlertDialog（confirm delete） | `components/ui/alert-dialog.tsx` | **shadcn 新增**（基於既有 `dialog.tsx`） |
| Tag chips（TagsInput） | 本 change 新建：`features/admin-routes/TagsInput.tsx` | New |
| Dropzone | 本 change 新建：`features/admin-routes/GpxDropzone.tsx` | New |
| Map preview | `features/admin-routes/RouteMapPreview.tsx` + `lib/map/createMap` | 既有 lib/map |

## Acceptance criteria

實作完成後需符合以下 frame-to-code 對應（每條都對應 design.md / tasks.md 的具體 requirement，verification-before-completion 將以視覺 diff 驗收）：

### 01 — /admin/upload happy
- WHEN admin GET `/admin/upload` 且尚未選檔 THEN 頁面結構需匹配 frame `58:3`：top nav 顯示「上傳」active、hero「新增路線」、副標、虛線邊框 dropzone 含上傳 icon + 「拖放 GPX 或點擊選擇」+「.gpx · 上限 10 MB」copy
- AND dropzone 在拖入合法 GPX 之前不渲染 RouteMetadataForm

### 02 — /admin/routes happy
- WHEN admin GET `/admin/routes` 且 routes 表 ≥ 1 THEN 頁面結構需匹配 frame `59:2`：top nav 顯示「路線管理」active、hero「路線管理」+ 計數副標 `N 條 · X 已發佈 · Y 草稿`、右上 `+ 新增路線` brand 色 CTA、Table 含 6 欄（標題 / Slug / 區域 / 狀態 / 紀錄日 / 操作）
- AND draft row 在「標題」cell 顯示草稿 badge（surface-muted bg），「狀態」cell 顯示 `● 草稿`（fgMuted）
- AND published row「狀態」cell 顯示 `● 已發佈`（brand 色背景）
- AND 操作欄含「編輯」（brand 色連結）+ 「刪除」（danger 色連結），中間以 `·` 分隔

### 03 — /admin/routes/[id] edit
- WHEN admin GET `/admin/routes/{id}` 對應已存在 route THEN 頁面結構需匹配 frame `60:2`：breadcrumb「路線管理 / 編輯」、hero「編輯路線 · {title}」、兩欄佈局（左欄編輯表單卡 / 右欄 READ-ONLY GPX 衍生卡）
- AND 左欄表單欄位順序：title / slug / description / region / tags / difficulty + duration (橫排) / published toggle / 操作列
- AND 右欄渲染「GPX 衍生（鎖定）」標題 + READ-ONLY chip + 「距離 / 累積爬升 / 軌跡點數 / 紀錄時間 / gpx_path」5 行 mono 字資料
- AND 操作列右對齊「取消」outline button +「儲存」brand button

### 04 — /admin/routes empty
- WHEN admin GET `/admin/routes` 且 routes 表為空 THEN 結構需匹配 frame `61:2`：頁標題「路線管理」+ 虛線邊框大卡片含 folder icon、「尚無路線」display 字、副標「請至 /admin/upload 新增第一條路線。」+ brand 色 `+ 新增路線` CTA

### 05 — /admin/upload error
- WHEN Server Action createRoute 回 `{ ok: false, fieldErrors }` THEN 頁面結構需匹配 frame `61:18`：頂部 `_form` Alert 條（danger bg + danger left border + ⚠ icon + 標題「寫入失敗」+ 副標「請修正下列欄位後重試。」）
- AND 對應欄位（例：slug）紅色邊框 + 下方 `✕ {message}` 紅字
- AND 「儲存」按鈕仍可點

### 06 — Dropzone states (composite reference)
- 此 frame `62:2` 不對應單一頁面；作為 `<GpxDropzone>` 元件視覺狀態的設計契約
- WHEN dropzone 未接收 file THEN UI 為 empty 狀態（中央三行：icon + 「拖放 GPX 或點擊選擇」+ `.gpx · 上限 10 MB`）
- WHEN dropzone 接收合法 file THEN 上方顯示綠色 ✓ 邊框的 file chip（檔名 mono + size + ×），下方依序顯示 map preview（含 GPX 簡化 polyline）與 parsed metadata 卡
- WHEN dropzone 接收非法 file THEN UI 切到 danger bg + danger 邊框、icon 變紅色驚嘆 + 主訊息「請選 .gpx 檔」或「檔案超過 10 MB」

### 07 — /admin/routes confirm delete
- WHEN admin 在 `/admin/routes` 列表點某 row 的「刪除」THEN 視覺需匹配 frame `62:83`：頁面以 45% 黑色 backdrop dim，置中 AlertDialog（480px 寬）含 ⚠ icon + 「確認刪除路線？」+ 內文「將永久刪除「{title}」，含 GPX 原檔（{gpx_path}）。」+ 強調「此操作不可還原。」+ 操作列「取消」outline button 與「確認刪除」danger 色 button

## Not in scope

- Loading state（submit 中按鈕 disabled 已由 `useTransition` pending 控制，視覺上僅 button disabled，不另出 frame）
- Authenticated vs unauthenticated（middleware 在 Wave C 已守住 admin pages；本 change 不涉及未登入畫面）
- Disabled / read-only state 的全頁版本（GPX 衍生欄位 read-only 已在 frame 03 右欄展現）
- 行動裝置 viewport（admin 由 Yuki 桌面使用；響應式留待未來 change）

## Probable next steps

按 spec-driven-dev 工序：本 change `writing-figma` 完成後進 `writing-spec` 產 proposal.md + capability spec。
