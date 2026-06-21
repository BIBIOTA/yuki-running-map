---
change_id: feat-admin-gpx-upload
doc_language: 繁體中文
---

## Why

Wave C 結束時，`/admin/upload` 仍是 `placeholder-pages` 的「Coming soon · GPX 上傳開發中」殼。本 change 把 admin 端的 GPX 上傳實作起來，並一併納入路線列表、metadata 編輯、刪除三個操作，讓 Yuki 可以完整以 UI 管理 `routes` 表。完成後：

- `/admin/upload` 進入「拖放 GPX → client 預覽 → 填表 → Server Action 上傳 + INSERT」實作
- `/admin/routes` 新增「列出所有 routes（含草稿）+ 編輯 / 刪除」
- `/admin/routes/[id]` 新增「編輯既有 route metadata」（GPX 衍生欄位鎖死）
- 刪除為硬刪除（routes row + `gpx` Storage 原檔），confirm dialog 防呆

bootstrap `design.md` §5.4 已先以概念描繪上傳；本 change 是該段的具體實作 + 範圍擴張為完整 admin CRUD。

## What Changes

- **admin-routes-crud** (ADDED Requirements)：
  - `/admin/upload` 改寫為實際上傳 UI（含 dropzone / map preview / metadata form）
  - `/admin/routes` 列表頁（admin RLS 看得到草稿）+ 編輯 / 刪除入口
  - `/admin/routes/[id]` metadata 編輯頁（GPX 衍生欄位 read-only）
  - `createRoute` Server Action：validate → server `parseGpx` → Storage upload → INSERT → revalidate；失敗回 union `fieldErrors` 並 rollback Storage
  - `updateRoute` Server Action：validate → SELECT oldSlug → UPDATE metadata（strip GPX-derived keys）→ revalidate
  - `deleteRoute` Server Action：SELECT gpx_path → DELETE row → storage.remove（best-effort）→ revalidate；idempotent 0-rows
  - `RouteMetadataForm` 共用元件，依規則驗 title / slug / description / region / tags / difficulty / duration / published
  - `GpxDropzone` client 端驗副檔名 + size + 解析；empty / loaded / error 三狀態
  - `AdminTopNav` 增加 `/admin/routes` 連結
  - E2E：改寫 `e2e/admin-upload.spec.ts`；新增 `e2e/admin-route-edit.spec.ts` 與 `e2e/admin-route-delete.spec.ts`
- **placeholder-pages** (REMOVED Requirements)：
  - 刪除 `/admin/upload shows the Coming soon placeholder for authenticated admin` 既有 requirement — 已被 admin-routes-crud 取代

## Impact

- **Affected specs**：
  - `specs/admin-routes-crud/`（新 capability，ADDED 10 個 Requirements）
  - `specs/placeholder-pages/`（REMOVED 1 個 Requirement）
- **Affected code**：
  - 新增：`features/admin-routes/`（UI 元件 + 3 個 Server Actions + tests）、`lib/admin-routes/{validation,gpxFile,listExistingTags}.ts`、`lib/db/errors.ts`、`app/(admin)/admin/routes/{page,[id]/page}.tsx`、`e2e/admin-route-{edit,delete}.spec.ts`
  - 修改：`app/(admin)/admin/upload/page.tsx`（placeholder → 真實表單）、`features/admin-auth/AdminTopNav.tsx`（加 /admin/routes 連結）、`e2e/admin-upload.spec.ts`（改寫 happy path）
  - 新增 shadcn primitives（implementation 階段拉入）：`components/ui/{select,table,badge,switch,alert,alert-dialog}.tsx`
- **Breaking changes**：
  - 視覺：`/admin/upload` 從「Coming soon」殼 → 真實上傳表單；Yuki 既有 GitHub OAuth 流程不變
  - Spec：`placeholder-pages` 的 `/admin/upload` requirement REMOVED；下游 e2e 也需從「斷言 Coming soon」改為「實際上傳」
- **External services**：無新增。RLS / Storage / Auth 沿用 Wave C 已建立的 policies
- **Risk**：
  - Storage upload 成功但 INSERT 失敗 → orphan GPX：createRoute catch 內 `storage.remove([path])` rollback；integration test 涵蓋 slug 衝突路徑
  - Delete 順序錯導致 anon 短暫可讀 404 GPX：強制 row → Storage 順序，且 RLS policy 在 row 刪後立即隱藏 path
  - Slug 改名後舊路徑 ISR 快取：updateRoute 同時 revalidate 新舊 slug
  - GPX > 10 MB：client + server 雙重 size 檢查
  - Wave C `/admin/upload` placeholder spec 衝突：本 proposal REMOVED 該 requirement

## Related Artifacts

### Design
- [design.md](./design.md)
- [tasks.md](./tasks.md)

### Diagrams
- [Sequence: createRoute orchestration](./diagrams/01-sequence-create-route.puml)
- [Sequence: deleteRoute hard delete](./diagrams/02-sequence-delete-route.puml)
- [Activity: Server Action result handling](./diagrams/03-activity-action-result-handling.puml)

### Figma Designs
- [Figma reference](./designs/figma.md) — 7 wireframe frames 於 file `Yx9G0efBQq3amHPEyeVSDc` 的新 page `Admin · feat-admin-gpx-upload`
