# Data model

Mirrors `openspec/changes/bootstrap-yuki-running-map/design.md` §4 and the `routes` Drizzle schema (introduced in Wave B). This doc is the long-form reference; design.md is the change-scoped source of truth.

## `routes` table

```ts
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug            text UNIQUE NOT NULL          -- 'tamsui-river-15k'
title           text NOT NULL                 -- '淡水河左岸 15K'
description     text                          -- markdown
distance_m      int  NOT NULL                 -- 公尺
elevation_gain_m int NOT NULL                 -- 累積爬升
duration_s      int                           -- 可選 (紀錄時的耗時)
recorded_at     timestamptz NOT NULL
location_name   text                          -- '淡水河左岸'
region          text                          -- '台北' '東京' (篩選用)
tags            text[] NOT NULL DEFAULT '{}'  -- ['河濱','LSD','夜跑']
difficulty      enum('easy','medium','hard') NOT NULL
gpx_path        text NOT NULL                 -- 'gpx/2025/abc-def-123.gpx'
geojson         jsonb NOT NULL                -- 簡化後的 LineString (給列表 thumbnail)
bbox            geometry(Polygon,4326) NOT NULL  -- PostGIS · 地圖框選搜尋
start_point     geometry(Point,4326)   NOT NULL  -- 「距我最近」排序
cover_image     text                          -- 可選封面圖 URL
published       boolean NOT NULL DEFAULT false
created_at      timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```

## Indexes

| Index                     | Purpose                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `GIST(bbox)`              | Viewport / 地圖框選搜尋。`WHERE ST_Intersects(bbox, ST_MakeEnvelope(...))` 在 12k+ rows 仍 < 50ms。 |
| `GIST(start_point)`       | 「距我最近」排序：`ORDER BY start_point <-> ST_MakeePoint(lng, lat)`。                              |
| `btree(recorded_at DESC)` | 列表預設排序：最新優先。                                                                            |
| `GIN(tags)`               | Tag 篩選：`WHERE tags && ARRAY['河濱']`。                                                           |
| `UNIQUE(slug)`            | URL 對應；slug 是穩定 ID，給 SEO 用。                                                               |

## Why both `geojson` and `gpx_path`?

兩個欄位看起來重複，但承擔不同責任：

- **`gpx_path`**：原始 GPX 檔，存在 Supabase Storage（`gpx/{yyyy}/{uuid}.gpx`）。下載按鈕直接給 signed URL；高精度繪圖時 client 也可拉這個。
- **`geojson`**：簡化後的 `LineString`（容差 0.0001°，~100–500 個點），存在 Postgres jsonb。列表頁批次畫 N 條軌跡縮圖時，**不能**每張縮圖都去 Storage 拉原始 GPX 解析——這會把 GPX 拉爆。

實作邏輯：上傳 Server Action 同步寫兩個——原檔上 Storage、簡化後寫 DB。

## Row Level Security (RLS)

`routes` table policies:

```sql
-- Anonymous SELECT: 只能看 published rows
CREATE POLICY anon_read_published ON routes
FOR SELECT
USING (published = true);

-- Admin (matching ADMIN_GITHUB_USERNAME) full write access
CREATE POLICY admin_write ON routes
FOR ALL
USING (
  (auth.jwt()->'user_metadata'->>'user_name') = current_setting('app.admin_github_username', true)
);
```

> `current_setting('app.admin_github_username')` 由 server connection 在 session 初始化時 `SET LOCAL` 灌入，避免硬寫死。具體實作於 `lib/supabase/server.ts`（Wave B）。

Storage RLS（`gpx` bucket）：

```sql
-- Public read disabled at bucket level; 改用 signed URL
-- Admin write only:
CREATE POLICY admin_write_storage ON storage.objects
FOR INSERT, UPDATE, DELETE
USING (
  bucket_id = 'gpx'
  AND (auth.jwt()->'user_metadata'->>'user_name') = current_setting('app.admin_github_username', true)
);
```

## Map search SQL example

地圖搜尋是核心功能。前端傳 viewport bbox（`minLng,minLat,maxLng,maxLat`），後端：

```sql
SELECT
  id, slug, title, distance_m, elevation_gain_m, region, tags, difficulty,
  geojson, ST_AsGeoJSON(start_point) AS start_point_geojson
FROM routes
WHERE published = true
  AND ST_Intersects(
        bbox,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
ORDER BY recorded_at DESC
LIMIT 50;
```

性能注意：

- `GIST(bbox)` 必須在；缺少時 query plan 退回 Seq Scan。
- 50 是合理上限——一個 viewport 內出現超過 50 條軌跡會視覺爆炸；UI 應該提示「縮小範圍」。
- `ST_AsGeoJSON(start_point)` 在 row count > 50 時開銷可觀；只在「需要起點 marker」時才送回去。

## Future schema considerations

下列尚未實作，但若未來需求出現會新增：

- **`route_images` table**：若 cover image 演化為「多圖相簿」，需 1-N 關聯 + 排序欄位。
- **`route_stats` materialized view**：總公里數、總爬升、年度統計。寫入時不刷新，定期 refresh 即可。
- **`page_views` table**：訪客流量統計。但目前傾向用 Vercel Web Analytics / Umami，不放進 Postgres。

## See also

- 來源 spec: [design.md §4](../openspec/changes/bootstrap-yuki-running-map/design.md)
- 系統架構: [architecture.md](./architecture.md)
- Drizzle 實作將在 Wave B 落地 — task 3.3 ~ 3.5 of [tasks.md](../openspec/changes/bootstrap-yuki-running-map/tasks.md)
