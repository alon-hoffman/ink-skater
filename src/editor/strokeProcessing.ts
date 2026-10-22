import {
  CONTROL_SPACING,
  distToPolyline,
  pathLength,
  resample,
  strokeGeometry,
} from '../levels/geometry';
import type { Stroke, Vec2 } from '../levels/levelTypes';
import { MAX_POINTS_PER_STROKE } from '../levels/levelSerialization';

/** Strokes shorter than this (world units) are treated as accidental taps and discarded. */
export const MIN_STROKE_LENGTH = 20;

let counter = 0;
export function newId(prefix: string): string {
  counter++;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function dropDuplicates(points: readonly Vec2[], minDist: number): Vec2[] {
  const out: Vec2[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Moving-average smoothing that keeps the two endpoints exactly where the pen started and ended. */
function smooth(points: readonly Vec2[], passes: number): Vec2[] {
  let cur = points.map((p) => ({ ...p }));
  for (let pass = 0; pass < passes; pass++) {
    const next = cur.map((p) => ({ ...p }));
    for (let i = 1; i < cur.length - 1; i++) {
      const a = cur[i - 1];
      const b = cur[i];
      const c = cur[i + 1];
      if (a && b && c) next[i] = { x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 };
    }
    cur = next;
  }
  return cur;
}

/**
 * Turn raw pointer samples into stroke control points: de-duplicated, smoothed and resampled
 * to an even spacing so the generated physics geometry stays small and rideable.
 * Returns null for taps and scribbles too short to ride.
 */
export function processFreehand(raw: readonly Vec2[]): Vec2[] | null {
  const cleaned = dropDuplicates(raw, 1.5);
  if (cleaned.length < 2 || pathLength(cleaned) < MIN_STROKE_LENGTH) return null;
  const smoothed = smooth(cleaned, 3);
  let spacing = CONTROL_SPACING;
  let points = resample(smoothed, spacing);
  while (points.length > MAX_POINTS_PER_STROKE) {
    spacing *= 1.5;
    points = resample(smoothed, spacing);
  }
  return points.length >= 2 ? points : null;
}

export function createStroke(raw: readonly Vec2[]): Stroke | null {
  const points = processFreehand(raw);
  return points ? { id: newId('stroke'), points } : null;
}

/** Distance from a world point to the visible curve of a stroke. */
export function distanceToStroke(stroke: Stroke, p: Vec2): number {
  const geo = strokeGeometry(stroke);
  const b = geo.bounds;
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dy = Math.max(b.minY - p.y, 0, p.y - b.maxY);
  if (Math.hypot(dx, dy) > 200) return Infinity;
  return distToPolyline(p, geo.dense);
}

/** Topmost (last drawn) stroke within `tolerance` world units of the point. */
export function findStrokeAt(
  strokes: readonly Stroke[],
  p: Vec2,
  tolerance: number,
): Stroke | null {
  let best: Stroke | null = null;
  let bestDist = tolerance;
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (!s) continue;
    const d = distanceToStroke(s, p);
    if (d <= bestDist) {
      best = s;
      bestDist = d - 0.001;
    }
  }
  return best;
}
