/**
 * Pure view logic for `<ElevationProfile>` (task 2.6, used by task 2.7).
 *
 * Lives separately from the React component so vitest can cover it in the
 * node environment (CLAUDE.md forbids adding React testing library deps).
 * The component is a thin JSX wrapper around the structures returned here.
 *
 * Spec: openspec/changes/feat-gpx-driven-route-metadata/specs/route-elevation-profile/spec.md
 *       ADDED Requirement "ElevationProfile renders SVG or empty hint"
 */

/** Output dimensions in user-space units (SVG handles responsive scaling). */
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 200;
const PADDING_X = 48;
const PADDING_Y = 20;
const PLOT_WIDTH = SVG_WIDTH - PADDING_X * 2;
const PLOT_HEIGHT = SVG_HEIGHT - PADDING_Y * 2;

/** Coordinate of an axis label, already mapped to SVG user space. */
export interface AxisLabel {
  /** Underlying data value (metres for y, metres for x). */
  value: number;
  /** Pixel position along the relevant axis (x or y). */
  position: number;
  /** Human-readable text — distance in km, elevation in m. */
  text: string;
}

export type ProfileView =
  | {
      kind: "filled";
      d: string;
      viewBox: string;
      xLabels: AxisLabel[];
      yLabels: AxisLabel[];
    }
  | { kind: "empty" };

/**
 * Map a `[distance_m, elevation_m]` profile to an SVG-ready view model.
 * Empty input short-circuits to `{ kind: 'empty' }` so the component can
 * render the empty-state hint instead.
 */
export function profileToSvg(
  profile: ReadonlyArray<readonly [number, number]>,
): ProfileView {
  if (profile.length === 0) return { kind: "empty" };

  const distances = profile.map((p) => p[0]);
  const elevations = profile.map((p) => p[1]);

  const minD = distances[0] ?? 0;
  const maxD = distances[distances.length - 1] ?? 0;
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);

  const dSpan = maxD - minD || 1;
  const eSpan = maxE - minE || 1;

  const mapX = (d: number): number => PADDING_X + ((d - minD) / dSpan) * PLOT_WIDTH;
  // y inverts: higher elevation → lower SVG y
  const mapY = (e: number): number =>
    PADDING_Y + (1 - (e - minE) / eSpan) * PLOT_HEIGHT;

  let d = `M${mapX(profile[0]![0])},${mapY(profile[0]![1])}`;
  for (let i = 1; i < profile.length; i++) {
    const point = profile[i]!;
    d += ` L${mapX(point[0])},${mapY(point[1])}`;
  }

  const xLabels: AxisLabel[] = [
    {
      value: minD,
      position: mapX(minD),
      text: `${(minD / 1000).toFixed(0)}km`,
    },
    {
      value: maxD,
      position: mapX(maxD),
      text: `${(maxD / 1000).toFixed(1).replace(/\.0$/, "")}km`,
    },
  ];

  const yLabels: AxisLabel[] = [
    { value: maxE, position: mapY(maxE), text: `${Math.round(maxE)}m` },
    { value: minE, position: mapY(minE), text: `${Math.round(minE)}m` },
  ];

  return {
    kind: "filled",
    d,
    viewBox: `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`,
    xLabels,
    yLabels,
  };
}
