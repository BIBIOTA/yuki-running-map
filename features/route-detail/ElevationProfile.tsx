/**
 * `<ElevationProfile profile={...} />` — server component for the public
 * `/routes/[slug]` detail page.
 *
 * Pure SVG, server-rendered. No client-side JavaScript (hover tooltip /
 * animation is out-of-scope per design.md §10.6).
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-elevation-profile/spec.md
 *       ADDED Requirement "ElevationProfile renders SVG or empty hint"
 * Tasks: openspec/changes/feat-gpx-driven-route-metadata/tasks.md §2.7
 * Figma: openspec/changes/feat-gpx-driven-route-metadata/designs/figma.md
 *        frame `70:7` (海拔曲線 section)
 *        frame `70:8` (empty state — "此路線無海拔資料")
 *
 * Testability: all view math lives in `./elevationProfileView.ts`; this
 * file is a thin JSX wrapper consistent with the project's no-RTL
 * convention.
 */

import { profileToSvg } from "./elevationProfileView";

interface ElevationProfileProps {
  profile: Array<[number, number]>;
}

export function ElevationProfile({ profile }: ElevationProfileProps) {
  const view = profileToSvg(profile);

  if (view.kind === "empty") {
    return (
      <p data-testid="elevation-empty" className="text-muted-foreground">
        此路線無海拔資料
      </p>
    );
  }

  return (
    <svg
      data-testid="elevation-profile"
      viewBox={view.viewBox}
      role="img"
      aria-label="海拔曲線"
      className="h-44 w-full"
      preserveAspectRatio="none"
    >
      {/* Horizontal elevation gridlines — drawn first so the curve paints on top. */}
      {view.yLabels.map((label) => (
        <line
          key={`grid-${label.value}`}
          x1={view.plotXStart}
          x2={view.plotXEnd}
          y1={label.position}
          y2={label.position}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 3"
          className="text-border"
        />
      ))}
      {/* Curve */}
      <path
        d={view.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-accent"
      />
      {/* Y-axis labels (elevation in metres) */}
      {view.yLabels.map((label) => (
        <text
          key={`y-${label.value}`}
          x={8}
          y={label.position + 4}
          fontFamily="var(--font-mono)"
          fontSize={10}
          className="fill-muted-foreground"
        >
          {label.text}
        </text>
      ))}
      {/* X-axis labels (distance in km) */}
      {view.xLabels.map((label) => (
        <text
          key={`x-${label.value}`}
          x={label.position}
          y={195}
          fontFamily="var(--font-mono)"
          fontSize={10}
          className="fill-muted-foreground"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}
