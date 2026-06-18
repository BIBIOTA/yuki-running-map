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

- **`gpx_path`**：原始 GPX 檔，存在 Supabase Storage（`gpx/{yyyy}/{uuid}.gpx`）。`gpx` bucket 設 `public=true`，但 RLS policy 限定「`published=true` 的 row 對應的 path 才可被任何人讀取」，所以 published route 的下載按鈕可直接給 public URL；草稿（`published=false`）的 GPX path 因 policy 過濾而不公開，僅 admin token 可列出。
- **`geojson`**：簡化後的 `LineString`（容差 0.0001°，~100–500 個點），存在 Postgres jsonb。列表頁批次畫 N 條軌跡縮圖時，**不能**每張縮圖都去 Storage 拉原始 GPX 解析——這會把 GPX 拉爆。

實作邏輯：上傳 Server Action 同步寫兩個——原檔上 Storage、簡化後寫 DB。

## Row Level Security (RLS)

Admin identity is encoded by a SQL function：

```sql
CREATE OR REPLACE FUNCTION public.app_admin_github_username()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '<ADMIN_GITHUB_USERNAME>'::text $$;
```

`routes` table policies（兩條）：

```sql
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Anonymous SELECT: 只能看 published rows
CREATE POLICY anon_read_published ON routes
FOR SELECT
USING (published = true);

-- Admin (matching ADMIN_GITHUB_USERNAME) full CRUD access
CREATE POLICY admin_full_access ON routes
FOR ALL
USING (
  (auth.jwt()->'user_metadata'->>'user_name') = public.app_admin_github_username()
)
WITH CHECK (
  (auth.jwt()->'user_metadata'->>'user_name') = public.app_admin_github_username()
);
```

> `public.app_admin_github_username()` 是 migration 寫死的 IMMUTABLE SQL function，planner 會 inline 到 policy expression。改 admin username 需起一支 follow-up migration 重新 `CREATE OR REPLACE FUNCTION`（單一 admin 的個人專案可接受）。此設計取代過去嘗試的 cluster-level `ALTER DATABASE ... SET app.admin_github_username`——Supabase managed `postgres` role 沒權限改 cluster-level custom parameters，故改用 function 封裝。jwt 不含 `user_name`（未登入 anon）時比對結果 NULL，policy 拒絕，fail-closed。
>
> 注意：`public.app_admin_github_username()` 的回傳值與 `ADMIN_GITHUB_USERNAME` env 是**兩個獨立的事實源**，需保持手動同步——前者由 RLS 比對使用，後者由 middleware 比對使用。

Storage RLS（`gpx` bucket）：

bucket 設 `public=true`（與 `tiles` bucket 一同由 RLS migration 內以 `INSERT INTO storage.buckets ... ON CONFLICT DO UPDATE` 內聯化建立），SELECT 仍受 RLS policy 過濾——只有「對應到 `published=true` 的 row」的 path 才會被放行。Admin 透過 jwt + admin identity function 比對取得寫入權。

```sql
-- Public read with conditional policy
CREATE POLICY gpx_public_select_published ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gpx'
  AND EXISTS (
    SELECT 1 FROM routes
    WHERE gpx_path = storage.objects.name
      AND published = true
  )
);

-- Admin write
CREATE POLICY gpx_admin_write ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'gpx'
  AND (auth.jwt()->'user_metadata'->>'user_name')
      = public.app_admin_github_username()
);

CREATE POLICY gpx_admin_modify ON storage.objects
FOR UPDATE USING (
  bucket_id = 'gpx'
  AND (auth.jwt()->'user_metadata'->>'user_name')
      = public.app_admin_github_username()
);

CREATE POLICY gpx_admin_delete ON storage.objects
FOR DELETE USING (
  bucket_id = 'gpx'
  AND (auth.jwt()->'user_metadata'->>'user_name')
      = public.app_admin_github_username()
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
