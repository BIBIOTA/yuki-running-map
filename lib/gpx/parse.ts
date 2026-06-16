import type { Feature, LineString } from "geojson";
import type { BBox2D, GpxMetadata, LngLat } from "./types";

import { XMLParser } from "fast-xml-parser";

import { simplifyLineString } from "./simplify";

/**
 * Earth's mean radius in metres. Used by the Haversine distance formula.
 * Good to ~0.5% accuracy across the globe, which is well inside the
 * ±5 m fixture tolerance documented in the spec for trail-length routes.
 */
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Shape of a single `<trkpt>` after `fast-xml-parser` has converted it.
 * The library exposes attributes via the `@_` prefix (configurable below)
 * and unwraps single-element children as scalars; this interface mirrors
 * that exact convention so we never need an `any` cast downstream.
 */
interface RawTrkpt {
  "@_lat": number | string;
  "@_lon": number | string;
  ele?: number | string;
  time?: string;
}

interface RawTrkseg {
  trkpt?: RawTrkpt | RawTrkpt[];
}

interface RawTrk {
  trkseg?: RawTrkseg | RawTrkseg[];
}

interface RawGpx {
  gpx?: {
    trk?: RawTrk | RawTrk[];
  };
}

interface TrackPoint {
  lng: number;
  lat: number;
  ele?: number;
  time?: Date;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Coerce a parsed XML scalar (which may arrive as `number` or `string`)
 * into a finite `number`, or `undefined` if it cannot be interpreted.
 */
function toFiniteNumber(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Walk the parsed GPX object and pull out every `<trkpt>` across every
 * `<trk>`/`<trkseg>`, in document order, normalising each into a
 * `TrackPoint`. Points with invalid lat/lng are silently dropped — GPX
 * files in the wild occasionally include `0,0` "ghost" points at the start
 * of a recording, and we do not want those to skew the bbox or distance.
 */
function extractTrackPoints(parsed: RawGpx): TrackPoint[] {
  const points: TrackPoint[] = [];
  const tracks = ensureArray(parsed.gpx?.trk);
  for (const trk of tracks) {
    const segments = ensureArray(trk.trkseg);
    for (const seg of segments) {
      const trkpts = ensureArray(seg.trkpt);
      for (const trkpt of trkpts) {
        const lat = toFiniteNumber(trkpt["@_lat"]);
        const lng = toFiniteNumber(trkpt["@_lon"]);
        if (lat === undefined || lng === undefined) continue;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

        const point: TrackPoint = { lng, lat };
        const ele = toFiniteNumber(trkpt.ele);
        if (ele !== undefined) point.ele = ele;
        if (typeof trkpt.time === "string") {
          const date = new Date(trkpt.time);
          if (!Number.isNaN(date.getTime())) point.time = date;
        }
        points.push(point);
      }
    }
  }
  return points;
}

/**
 * Great-circle distance between two `[lng, lat]` points in metres,
 * using the Haversine formula.
 */
function haversineMetres(a: TrackPoint, b: TrackPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeDistanceM(points: ReadonlyArray<TrackPoint>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    total += haversineMetres(prev, curr);
  }
  return total;
}

/**
 * Cumulative positive elevation gain. Negative deltas (descents) are
 * ignored. Points without an `ele` value are treated as continuations of
 * the previous known elevation — this avoids fictitious gain when a stray
 * trackpoint is missing the tag.
 */
function computeElevationGainM(points: ReadonlyArray<TrackPoint>): number {
  let gain = 0;
  let previousEle: number | undefined;
  for (const point of points) {
    if (point.ele === undefined) continue;
    if (previousEle !== undefined) {
      const delta = point.ele - previousEle;
      if (delta > 0) gain += delta;
    }
    previousEle = point.ele;
  }
  return gain;
}

function computeBbox(points: ReadonlyArray<TrackPoint>): BBox2D {
  const first = points[0];
  if (!first) {
    throw new Error("computeBbox: cannot compute bbox of an empty track");
  }
  let minLng = first.lng;
  let minLat = first.lat;
  let maxLng = first.lng;
  let maxLat = first.lat;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Parse a GPX `Buffer` and return a `GpxMetadata` summary. The returned
 * `geojson.geometry.coordinates` is the *simplified* polyline (suitable for
 * list-page thumbnails); `distanceM`, `elevationGainM`, `bbox` and
 * `startPoint` are computed from the *full* trackpoint set so the metadata
 * stays accurate even when the rendered line is coarse.
 *
 * Throws when the input has no parseable `<trkpt>` elements — callers
 * should treat that as "this is not a valid GPX route".
 */
export function parseGpx(buffer: Buffer): GpxMetadata {
  const xml = buffer.toString("utf8");
  const parsed = xmlParser.parse(xml) as RawGpx;
  const points = extractTrackPoints(parsed);

  if (points.length === 0) {
    throw new Error("parseGpx: GPX file contains no valid trackpoints");
  }

  const firstPoint = points[0];
  if (!firstPoint) {
    throw new Error("parseGpx: GPX file contains no valid trackpoints");
  }

  const coords: LngLat[] = points.map((p) => [p.lng, p.lat]);
  const simplified = simplifyLineString(coords);

  const distanceM = computeDistanceM(points);
  const elevationGainM = computeElevationGainM(points);
  const bbox = computeBbox(points);
  const startPoint: LngLat = [firstPoint.lng, firstPoint.lat];

  const recordedAt = firstPoint.time ?? new Date(0);

  const geojson: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: simplified,
    },
    bbox,
  };

  return {
    geojson,
    distanceM,
    elevationGainM,
    bbox,
    startPoint,
    recordedAt,
  };
}
