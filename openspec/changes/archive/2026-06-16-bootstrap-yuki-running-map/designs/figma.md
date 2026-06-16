---
change_id: bootstrap-yuki-running-map
doc_language: 繁體中文
---

# Figma Designs: bootstrap-yuki-running-map

## Figma File
- File: <https://www.figma.com/design/Yx9G0efBQq3amHPEyeVSDc>
- File key: `Yx9G0efBQq3amHPEyeVSDc`
- File name: **Yuki's Running Map · Design System**
- Team: OTA YUKIのチーム (Dev seat)

## Selected Version

> **✅ Selected: V2 Trail Vintage**（2026-06-09 由 Yuki 決定）
>
> 後續 library change 與所有實作工作都以 V2 為唯一 source of truth。本檔保留 V1/V3 的紀錄純為決策歷史 reference，不應被當作可替代方案。

## Scope

本次 Figma 交付屬於 **「探索／挑選」階段**，目的是讓 Yuki 在 3 個視覺方向間挑選一個。每個版本以**靜態 mockup** 呈現 design system 的所有關鍵面：色票、Typography、Logo 4 variants、主要 components、Header/Footer。

**Out of scope（留待後續 change）**：
- Figma Variables（color/typography/spacing 等 token 化）
- Component / Component Set / Variants（互動 states 矩陣）
- Light/Dark mode 切換
- Empty / Loading / Error 完整 placeholder 元件
- Code Connect mappings
- 4 個功能頁（路線列表 / 詳情 / Login / Upload）的 page-level design

挑定版本後，**會另開一個 change**（建議 change-id：`figma-library-{選定版本}`）由 `spec-driven-dev:writing-figma` 嚴格走 Phase 0→4 完整 design system 流程。

## Versions

| Version | Page name | Frame node ID | Mood | Display | Body | Mono |
|---|---|---|---|---|---|---|
| **V1 Topo Minimal** | `V1 · Topo Minimal` | `6:2` | 戶外地圖、克制冷靜、等高線靈感 | Geist | Inter | JetBrains Mono |
| **V2 Trail Vintage** | `V2 · Trail Vintage` | `8:2` | 溫暖手繪、跡跡感、復古地誌 | Fraunces | Inter | IBM Plex Mono |
| **V3 Sport Mono** | `V3 · Sport Mono` | `9:2` | 高對比、運動品牌感、Strava 風 | Geist Mono | Inter | Geist Mono |
| **Cover (index)** | `🏠 Cover` | `10:2` | 三版並陳的入口頁 | — | — | — |

### 色票對照

| Token | V1 Topo Minimal | V2 Trail Vintage | V3 Sport Mono |
|---|---|---|---|
| `bg` | `#FAFCFE` | `#F8F1E0` | `#0A0A0A` |
| `surface` | `#FFFFFF` | `#FFFAEC` | `#161616` |
| `surface-muted` | `#F0F4F8` | `#ECE0C4` | `#1F1F1F` |
| `border` | `#DDE3EC` | `#D9C9A4` | `#2A2A2A` |
| `fg` | `#0F1B2D` | `#2A1F12` | `#FAFAFA` |
| `fg-muted` | `#4A5872` | `#6B5638` | `#9A9A9A` |
| `brand` | `#1E3A5F` 墨藍 | `#2F5D3A` 森綠 | `#C7F539` 螢光萊姆 |
| `accent` | `#5E8C61` 苔綠 | `#C26A3D` 鏽橘 | `#FF6B1A` 螢光橘 |
| `route-line` | `#2E5C8A` | `#C26A3D` | `#C7F539` |
| `elevation` | `#B4C5D9` | `#BFA77A` | `#4A4A4A` |

## Sections covered (per version)

每個版本頁面包含相同 5 個 sections（順序固定，便於並排比較）：

| # | Section | 內容 |
|---|---|---|
| 1 | **色票 · Palette** | 10 個 swatches：bg / surface / surface-muted / border / fg / fg-muted / brand / accent / route-line / elevation。每張含色塊、token 名、hex。 |
| 2 | **字型 · Typography** | 4 個層級：Display、Heading、Body、Mono。樣本句子使用真實情境語句（路線名 / 跑步描述 / 統計數字）。 |
| 3 | **Logo Set · 4 variants** | Light / Dark / Monochrome / Favicon。glyph 風格隨版本差異 — V1 等高線環抱「Y」、V2 跑者剪影 + 跑道弧線、V3 粗體 wordmark + 箭頭。 |
| 4 | **元件預覽 · Components** | Buttons（Primary / Secondary / Ghost）、Input（含 label + field）、Badges（5 種 tag）、Route Card（含 mini-map 軌跡 + meta）。 |
| 5 | **Layout · Header & Footer** | Site header（含 brand + nav）、Site footer（含 brand + copy）。 |

## Screenshots

| File | Caption |
|---|---|
| [screenshots/00-cover.png](screenshots/00-cover.png) | Cover index — 三版並陳的入口 |
| [screenshots/01-v1-topo-minimal.png](screenshots/01-v1-topo-minimal.png) | V1 Topo Minimal — 完整 mockup |
| [screenshots/02-v2-trail-vintage.png](screenshots/02-v2-trail-vintage.png) | V2 Trail Vintage — 完整 mockup |
| [screenshots/03-v3-sport-mono.png](screenshots/03-v3-sport-mono.png) | V3 Sport Mono — 完整 mockup |

## States Coverage（針對本探索階段）

| State | 涵蓋方式 |
|---|---|
| Theme Light + Dark | V1 與 V2 為 Light 主視覺；V3 為 Dark 主視覺；每版 Logo Set 內已含 Light/Dark/Monochrome/Favicon 四個 variant 證明色彩在亮暗背景皆可行 |
| Interactive states（hover/active/disabled） | **deferred** — 探索階段只示意 default；變體矩陣留給後續 library change |
| Form states（focused/error/disabled/readonly） | **deferred** — 同上 |
| Empty / Loading / Error placeholder | **deferred** — 本次設計裡 Route Card 已暗示 thumbnail/meta 結構，但無完整 empty/loading/error 元件 |

## Shared Components Used

本次全部為 **new**（探索階段，尚無 design system 可重用）。下列為下個 library change 須交付的 starter set：

- **Foundations**: Colors / Typography / Spacing / Radius / Shadow / Motion（須轉為 Figma Variables，本次未實作）
- **Components**: Button / Input / Card / Badge / Header / Footer / Logo set
- **暫不交付**: Toast / Dialog / Sheet / Tabs / Dropdown / Switch / Select（在後續功能頁面 change 時依需求才追加）

## Acceptance Criteria

1. **挑選決策**：Yuki 在三版中明確指定一版作為後續實作的 source of truth。
2. **mockup 結構**：三版皆完整呈現 5 個 sections，無缺漏。
3. **節點可追溯**：每版 root frame 的 nodeId 已記錄於本檔，後續 library change 可直接 `node-id=` 連結。
4. **色票一致性**：各版色票於 design.md §6 的 token slot 對應齊全（10 個 token 都有定義 hex）。
5. **字型可用性**：所有使用的 font 在 Figma 環境內可載入（Inter / Geist / Geist Mono / Fraunces / JetBrains Mono / IBM Plex Mono 均已驗證）；Recoleta / Söhne 在 Figma 不可用，已替代為 Fraunces / Geist Mono。
6. **後續銜接**：挑定版本後啟動的 library change 必須繼承本檔記錄的色票與字型，**不可在 library 階段再次重設**。

## Open Questions

1. ~~**挑哪一版？**~~ → **已決定 V2 Trail Vintage**（2026-06-09）
2. **Logo glyph favicon 縮放可見度**：V2 的跑者剪影 + 跑道弧線於 16×16 favicon size 能否仍可辨識？需 library 階段在實際輸出尺寸驗證；必要時為 favicon 設計簡化版（例：只留弧線 + 點）。
3. **V2 Fraunces vs Recoleta**：design.md 原規畫為 Recoleta（Figma 不可用），本次以 Fraunces 替代並已被選定。若 Yuki 後來想用 Recoleta，需於 library 階段購買授權並在程式碼端 swap；Figma 端保留 Fraunces 作為 design preview proxy。
4. **手寫感補強**：V2 mood 描述含「手寫 Yuki's」元素，目前 mockup 使用 Fraunces（serif，非手寫體）作為 wordmark。library 階段可考慮：(a) 保留 Fraunces 為主、僅 hero/cover 處點綴一個手寫元素（例如下劃線或 signature mark）；(b) 引入手寫體（Caveat / Homemade Apple / Permanent Marker）作為輔助 display。需在 library change 開頭再次確認方向。
