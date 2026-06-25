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

/** Target number of horizontal gridlines / elevation ticks. */
const TARGET_Y_TICKS = 4;

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
      /** Horizontal extent of the plot area; gridlines span [plotXStart, plotXEnd]. */
      plotXStart: number;
      plotXEnd: number;
    }
  | { kind: "empty" };

/**
 * Snap a raw step value to the 1 / 2 / 5 / 10 "nice number" family so tick
 * values land on rounded elevations. Returns ticks within [min, max].
 */
export function niceElevationTicks(
  min: number,
  max: number,
  target = TARGET_Y_TICKS,
): number[] {
  if (max === min) return [min];
  const span = max - min;
  const raw = span / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  let nice: number;
  if (normalized <= 1.5) nice = 1;
  else if (normalized <= 3) nice = 2;
  else if (normalized <= 7) nice = 5;
  else nice = 10;
  const step = nice * magnitude;
  const first = Math.ceil(min / step) * step;
  const last = Math.floor(max / step) * step;
  const ticks: number[] = [];
  // Guard against FP drift so the last tick at exactly `max` isn't dropped.
  for (let v = first; v <= last + step * 1e-9; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

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

  const ticks = niceElevationTicks(minE, maxE);
  const yLabels: AxisLabel[] = ticks.map((v) => ({
    value: v,
    position: mapY(v),
    text: `${Math.round(v)}m`,
  }));

  return {
    kind: "filled",
    d,
    viewBox: `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`,
    xLabels,
    yLabels,
    plotXStart: PADDING_X,
    plotXEnd: SVG_WIDTH - PADDING_X,
  };
}
