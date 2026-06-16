import type { LngLat } from "./types";

/**
 * Maximum number of adaptive tolerance retries when the initial simplification
 * lands outside the [MIN_POINTS, MAX_POINTS] band. Each iteration doubles or
 * halves the working tolerance. Twelve iterations span four orders of
 * magnitude — more than enough for any realistic GPX track.
 */
const MAX_ITERATIONS = 12;

/** Lower bound on output point count when input is at least this large. */
const MIN_POINTS = 100;
/** Upper bound on output point count. */
const MAX_POINTS = 500;

/**
 * Perpendicular distance from `point` to the line through `lineStart` and
 * `lineEnd`, measured in raw degrees (lng/lat treated as planar Cartesian
 * coordinates). The values produced here only need to be self-consistent
 * within one call — we compare distances against `tolerance`, never against
 * real-world metres.
 */
function perpendicularDistance(point: LngLat, lineStart: LngLat, lineEnd: LngLat): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    // Degenerate segment — fall back to point-to-point distance.
    return Math.hypot(x - x1, y - y1);
  }

  // |(x2-x1)(y1-y) - (x1-x)(y2-y1)| / sqrt(dx^2 + dy^2)
  const numerator = Math.abs(dx * (y1 - y) - (x1 - x) * dy);
  const denominator = Math.hypot(dx, dy);
  return numerator / denominator;
}

/**
 * Ramer–Douglas–Peucker line simplification. Iterative implementation (no
 * recursion) so we never blow the stack on very long tracks.
 */
function rdp(coords: ReadonlyArray<LngLat>, tolerance: number): LngLat[] {
  if (coords.length < 3) return coords.slice();

  const lastIndex = coords.length - 1;
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[lastIndex] = 1;

  // Stack of [startIndex, endIndex] segments still to inspect.
  const stack: Array<[number, number]> = [[0, lastIndex]];

  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) break;
    const [start, end] = segment;
    const startPoint = coords[start];
    const endPoint = coords[end];
    if (!startPoint || !endPoint) continue;

    let maxDistance = 0;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const candidate = coords[i];
      if (!candidate) continue;
      const distance = perpendicularDistance(candidate, startPoint, endPoint);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance && maxIndex !== -1) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex]);
      stack.push([maxIndex, end]);
    }
  }

  const result: LngLat[] = [];
  for (let i = 0; i < coords.length; i++) {
    if (keep[i]) {
      const point = coords[i];
      if (point) result.push(point);
    }
  }
  return result;
}

/**
 * Simplify a polyline using Ramer–Douglas–Peucker. The first and last input
 * coordinates are always preserved.
 *
 * - `tolerance` defaults to `0.0001` (raw degrees, roughly 11 m near the
 *   equator) per the spec.
 * - For inputs with at least 100 coordinates, the working tolerance is
 *   adapted (doubled or halved) so the result lands in the spec-required
 *   `[100, 500]` point band when called with the default tolerance.
 * - For inputs with fewer than 100 coordinates the band is unreachable by
 *   simplification alone, so the RDP output at the given tolerance is
 *   returned as-is.
 */
export function simplifyLineString(
  coords: ReadonlyArray<LngLat>,
  tolerance: number = 0.0001,
): LngLat[] {
  if (coords.length <= 2) return coords.slice();

  // Small inputs cannot be expanded — just simplify once.
  if (coords.length < MIN_POINTS) {
    return rdp(coords, tolerance);
  }

  let workingTolerance = tolerance;
  let result = rdp(coords, workingTolerance);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (result.length > MAX_POINTS) {
      workingTolerance *= 2;
    } else if (result.length < MIN_POINTS) {
      workingTolerance /= 2;
    } else {
      break;
    }
    result = rdp(coords, workingTolerance);
  }

  return result;
}
