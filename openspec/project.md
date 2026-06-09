# openspec/project.md — Yuki's Running Map

## Purpose

**Yuki's Running Map** 是 Yuki 的個人跑步路線分享網站。功能核心是「拿出一條跑過的路線，附上地圖、GPX、海拔曲線，分享給訪客」。網站要有讓人想點開、想下載 GPX、想跑跑看的視覺與體驗。

## Stakeholders

| 角色 | 誰 | 權限 / 互動 |
|---|---|---|
| **Owner / Admin** | Yuki | 唯一可以登入、上傳路線、編輯/發佈 metadata 的人 |
| **訪客 (Visitor)** | 任何打開網址的人 | 瀏覽路線列表（含搜尋/排序/地圖框選）、檢視單一路線詳情、下載 GPX；無須登入、無互動帳號 |

沒有「會員」「追蹤者」「評論者」這類角色。整個站是 read-only + admin-only 的對稱。

## Long-term goals

1. **路線即作品**：每條路線都有像作品集一樣的詳情頁（封面圖、敘述、地圖、海拔曲線、tags）。
2. **SEO 友善**：訪客透過 Google 搜尋「淡水河 跑步路線」「陽明山 21K」之類關鍵字應該能找到對應路線詳情。
3. **地圖搜尋**：訪客可以在地圖上拖動 viewport 直接看到該範圍內的路線（PostGIS `ST_Intersects(bbox, …)`）。
4. **設計一致性**：V2 Trail Vintage 視覺系統 — 溫暖手繪、跡跡感、復古地誌；不偏離。
5. **長期維護成本低**：單一管理員、單一 Supabase 專案、單一 Vercel 專案；不引入需要持續運維的副系統。

## Non-goals

- **沒有會員系統**：訪客不會註冊、不會登入、不會留評論、不會收藏。
- **沒有付費功能**：免費瀏覽、免費 GPX 下載；不做訂閱、不放廣告。
- **沒有社交圖譜**：不做「追蹤其他跑者」「按讚」「分享到 IG」這類功能。
- **沒有跑團 / 多管理員**：唯一 admin 是 Yuki，靠 GitHub OAuth + `ADMIN_GITHUB_USERNAME` env 鎖死。
- **沒有及時追蹤**：本站不接 Strava webhook、不做活動即時同步；上傳是 Yuki 手動完成 GPX 的選擇性整理動作。
- **沒有 i18n**：UI 預設繁體中文；不做英文/日文版本切換。SEO 透過繁中內容處理。
- **沒有 PWA / 離線**：純線上瀏覽，不做 Service Worker、不做離線地圖。
- **沒有 Mobile App**：響應式 Web 為主，不做原生 App。

## Sources of truth

- 視覺方向：[openspec/changes/bootstrap-yuki-running-map/designs/figma.md](./changes/bootstrap-yuki-running-map/designs/figma.md) → V2 Trail Vintage
- 系統架構：[docs/architecture.md](../docs/architecture.md) + [openspec/changes/bootstrap-yuki-running-map/diagrams/01-component-system-architecture.puml](./changes/bootstrap-yuki-running-map/diagrams/01-component-system-architecture.puml)
- 資料模型：[docs/data-model.md](../docs/data-model.md)
- 開發 conventions：[AGENTS.md](../AGENTS.md)
