# Figma Designs: refactor-upload-metadata-fields

## Figma File
- File: <https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc>
- File key: `Yx9G0efBQq3amHPEyeVSDc`
- Page: `refactor-upload-metadata-fields` (node `84:2`)

## Versions
- [v1] single-variant — UX 已在 design.md 拍板，無 A/B 探索。

## Scope
The page contains two artefact groups:

1. **`upload-preview` happy-path** (Frame 01) — full upload-page layout after a GPX has been parsed (dropzone-loaded, RouteMapPreview placeholder, ElevationProfile reused, RouteRegions slot ready, RouteMetadataForm minus 標籤 欄位).
2. **`regions-states`** (Frames 02-05) — four focused captures of the RouteRegions slot in each `regionsState` variant required by design.md §6 / tasks.md §3.4 (`loading` / `ready` / `ready-empty` / `error`).

The state identifier is the frame name (e.g. `02 · regions slot · loading`) — frames intentionally do NOT carry in-frame developer annotation eyebrows so they read as faithfully as the production UI.

## Frames

| # | Frame name | Figma node | Screenshot | What it covers |
|---|---|---|---|---|
| 01 | `01 · /admin/upload (happy · loaded preview)` | `85:2` | `screenshots/01-upload-preview-happy.png` | Full upload preview after `phase.kind === 'loaded'`. Eyebrow 「/ADMIN/UPLOAD · HAPPY」 → 「新增路線」 H1 → dropzone-loaded chip → 路線預覽 (MapLibre placeholder) → 海拔曲線 (★ new section, reused `<ElevationProfile>` with sample SVG curve) → 途經區域 (★ new section, ready chips) → RouteMetadataForm (no 標籤 field). |
| 02 | `02 · regions slot · loading` | `87:2` | `screenshots/02-regions-loading.png` | `regionsState = { kind: 'loading' }`. Heading 「途經區域」 + hint 「正在判斷區域…」 + 1 paragraph-shaped skeleton line. |
| 03 | `03 · regions slot · ready` | `87:11` | `screenshots/03-regions-ready.png` | `regionsState = { kind: 'ready', regions: [≥1] }`. Heading 「途經區域」 + paragraph 「新北市 — 新店區、烏來區」 (county green Medium, em-dash muted, townships ink) — exactly what `<RouteRegions variant="stacked">` already produces — + hint 「由 GPX 自動偵測，不可手動修改。」. |
| 04 | `04 · regions slot · ready-empty` | `87:23` | `screenshots/04-regions-ready-empty.png` | `regionsState = { kind: 'ready', regions: [] }`. Heading 「途經區域」 + muted hint 「此路線未涵蓋任何已知行政區。」 + 「送出後仍會以 ST_Intersects 重新計算一次。」. |
| 05 | `05 · regions slot · error` | `87:29` | `screenshots/05-regions-error.png` | `regionsState = { kind: 'error', message }`. Heading 「途經區域」 + red-tinted alert box, 「✕ 無法預覽區域」 + explanation that the submit button stays enabled. |

## Shared chrome with public `/routes/[slug]`
**This is the load-bearing constraint of the regions section.** The 「途經區域」 chrome used on the upload page MUST be the same component used by the public route detail page (`app/(public)/routes/[slug]/page.tsx`):

```tsx
<section aria-labelledby="regions-heading" className="space-y-2">
  <h2
    id="regions-heading"
    className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
  >
    途經區域
  </h2>
  <RouteRegions regions={...} />
</section>
```

The Figma frames (01 regions block + 02-05) render the heading in IBM Plex Mono Medium 14px (raster legibility uplift from the production 12px) with `--muted-foreground = #6b5638` and the chip variants exactly as `<RouteRegions>` already produces them. The visual contract is:

- One heading style for both `/admin/upload` and `/routes/[slug]`.
- The `<RouteRegions>` component is the single source of truth for chip rendering — green-filled for `county`, outline-only for `township`.
- The empty-state copy diverges between contexts (admin upload tells the author the server will reassess; public detail simply hides the section), but the heading chrome remains identical.

## Shared components used

| Token / element | Source | Where it appears |
|---|---|---|
| `<RouteRegions>` component | existing (`components/RouteRegions.tsx`) | Frames 01 (regions block), 03 (chip row). Re-used as-is; no new chip variant introduced this change. |
| Section heading chrome (`font-mono text-xs tracking-widest text-muted-foreground uppercase` + 「途經區域」 string) | existing (`app/(public)/routes/[slug]/page.tsx`) | Frames 01 (regions block), 02-05. Identical to public detail page. |
| `<ElevationProfile>` component | existing (`features/route-detail/ElevationProfile.tsx`) | Frame 01 (海拔曲線 section). Re-used; no SVG re-author. |

Token reference (V2 Trail Vintage) for the frames:

| Token | Hex | Where it appears |
|---|---|---|
| cream (`--background`) | `#f8f1e0` | frame surfaces, input fills |
| green border (`--border` / `--primary`) | `#2f5d3a` | strokes, chip outlines, action button fill |
| white card | `#ffffff` | form / elevation / map card surfaces |
| ink (`--foreground`) | `#222222` | body text |
| muted-foreground (`--muted-foreground`) | `#6b5638` | mono headings, hints, axis labels |
| muted (`--muted`) | `#ece0c4` | regions-loading skeleton chips |
| rust orange (`--map-route-line`) | `#c26a3d` | elevation curve, map line note |
| destructive (`--destructive`) | `#b2322f` | error alert stroke + title |

Fonts: `Fraunces SemiBold` (display), `Inter Regular/Medium` (body/labels), `IBM Plex Mono Medium` (section headings, eyebrows).

## Acceptance Criteria

- **AC-1** (section order). When `UploadPageClient` enters `phase.kind === 'loaded'`, the rendered DOM SHALL contain the same vertical section order as frame `01`: `GpxDropzone (loaded chip) → RouteMapPreview → ElevationProfile (★ new) → RouteRegions slot (★ new) → RouteMetadataForm`.
- **AC-2** (elevation chrome reuse). The new 「海拔曲線」 section in frame `01` SHALL be backed by `<ElevationProfile>` from `features/route-detail/ElevationProfile.tsx`; no new SVG component is introduced. Card chrome (`bg-card`, `border-border`, `rounded-md`, `p-3`) MUST match `/routes/[slug]`.
- **AC-3** (regions chrome reuse — load-bearing). The 「途經區域」 heading on the upload page SHALL use the exact same JSX/className as the public detail page (`<h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">途經區域</h2>` inside `<section aria-labelledby="regions-heading">`). Implementations MUST refactor the heading into a shared component (e.g. `<RouteRegionsSection>` co-located with `<RouteRegions>` in `components/RouteRegions.tsx`) and import it on both pages so the chrome cannot drift.
- **AC-4** (paragraph rendering, NOT chips). Frame `03` mandates that ready-state regions render as `<RouteRegions variant="stacked">` already does: per-county paragraph with `font-medium text-primary` county name, ` — ` em-dash in `text-muted-foreground`, and townships in `text-foreground`. Implementations MUST NOT add chip / badge / pill UI; the component author already rejected that style on `feat-gpx-driven-route-metadata` ([frame 70:9](https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc?node-id=70-9)).
- **AC-5** (state variant rendering). The regions slot SHALL render the variant that matches `regionsState.kind`:
  - `loading` → heading + 「正在判斷區域…」 hint + 1 paragraph-shaped skeleton line (frame 02)
  - `ready` & `regions.length > 0` → heading + `<RouteRegions variant="stacked">` paragraph(s) (frame 03)
  - `ready` & `regions.length === 0` → heading + muted empty hint (frame 04); note `<RouteRegions>` returns `null` for 0 regions, so the empty hint is the upload-page-specific UI that sits inside `<RouteRegionsSection>` and is NOT shown on the public `/routes/[slug]` page (which simply hides the section)
  - `error` → heading + red-tinted alert box (frame 05)
- **AC-6** (loading skeleton, not spinner). Frame `02` mandates a paragraph-shaped skeleton line for the `loading` state. Implementations MUST NOT show a bare spinner — the skeleton shape mirrors the eventual paragraph height so layout does not jump on resolution.
- **AC-7** (submit never blocked). Frames `04` (`ready-empty`) and `05` (`error`) SHALL NOT disable the form submit button. The error frame's body explicitly tells the user that submission still works.
- **AC-8** (no tags). The 標籤 (TagsInput) field MUST NOT appear in the upload form. Frame `01`'s form card shows the production field set: `標題 / 網址代稱 (slug) / 描述 / 已發佈`. Any rendered 標籤 control is a regression.
- **AC-9** (edit page parity). The edit page (`/admin/routes/[id]`) MUST adopt the same 「海拔曲線」 section beneath its map preview (reusing `<ElevationProfile>` with the persisted `route.elevationProfile`). No new frame is required because the elevation chrome is visually identical to frame `01`'s elevation section. The existing edit-page regions block already uses the shared heading chrome from AC-3 once refactored.

## Implementation note: shared chrome refactor

Per AC-3, this change SHALL also do a tiny chrome refactor:

1. Lift the heading + `aria-labelledby` `<section>` wrapper out of `app/(public)/routes/[slug]/page.tsx` into a new client-safe `<RouteRegionsSection>` exported alongside `<RouteRegions>` (e.g. in `components/RouteRegions.tsx`).
2. Use `<RouteRegionsSection regions={...} />` on both `app/(public)/routes/[slug]/page.tsx` and the upload preview / edit page slots.
3. The upload `regionsState` UI (loading / ready-empty / error) reuses the same `<RouteRegionsSection>` shell with different children — the heading chrome stays in one place.

This is the actual mechanism that satisfies the user feedback 「途徑區域的區塊UI和前台不太一樣，我覺得這邊可以共用元件」.

## Notes

- The `01` map area is a coloured placeholder with a literal note describing the MapLibre layer config; the production component (`RouteMapPreview`) renders an actual MapLibre canvas in the browser.
- The elevation curve in `01` is an embedded SVG that mirrors the production `<ElevationProfile>` axis layout (Y: m, X: km) drawn with the rust-orange `#c26a3d` stroke. Illustrative, not derived from real data.
- Heading raster legibility: the Figma frames render headings at 14px (vs. the production `text-xs = 12px`) purely so that mono Chinese characters survive the PNG export. The production component MUST stay at `text-xs` to match `/routes/[slug]` exactly.
