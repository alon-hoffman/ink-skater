import type { Bounds, Stroke, Vec2 } from './levelTypes';

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += dist(a, b);
  }
  return total;
}

/** Resample a polyline at uniform arc-length spacing, always keeping the exact endpoints. */
export function resample(points: readonly Vec2[], spacing: number): Vec2[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return points.map((p) => ({ ...p }));
  const total = pathLength(points);
  const count = Math.max(1, Math.round(total / spacing));
  const step = total / count;
  const out: Vec2[] = [{ ...first }];
  let travelled = 0;
  let next = step;
  for (let i = 1; i < points.length && out.length < count; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const seg = dist(a, b);
    while (seg > 0 && travelled + seg >= next && out.length < count) {
      const t = (next - travelled) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      next += step;
    }
    travelled += seg;
  }
  out.push({ ...last });
  return out;
}

/** Uniform Catmull-Rom spline through the points, sampled `perSegment` times per span. */
export function catmullRom(points: readonly Vec2[], perSegment: number): Vec2[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out: Vec2[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(n - 1, i + 2)];
    if (!p0 || !p1 || !p2 || !p3) continue;
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  const last = points[n - 1];
  if (last) out.push({ ...last });
  return out;
}

export function boundsOf(points: readonly Vec2[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    if (p.x < b.minX) b.minX = p.x;
    if (p.y < b.minY) b.minY = p.y;
    if (p.x > b.maxX) b.maxX = p.x;
    if (p.y > b.maxY) b.maxY = p.y;
  }
  return b;
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function distToPolyline(p: Vec2, line: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (a && b) best = Math.min(best, distToSegment(p, a, b));
  }
  return best;
}

/** Spacing of the control points kept on a stroke. */
export const CONTROL_SPACING = 12;
/** Spacing of collision segments generated from the smooth curve. */
export const COLLISION_SPACING = 14;
const DENSE_PER_SEGMENT = 5;

export interface StrokeGeometry {
  /** Fine polyline of the rendered curve. */
  dense: Vec2[];
  /** Coarser polyline used for collision; stays within a fraction of a pixel of `dense`. */
  collision: Vec2[];
  bounds: Bounds;
}

const cache = new WeakMap<Stroke, StrokeGeometry>();

/** Single source of the stroke curve: both renderer and physics read this. Memoised per stroke object. */
export function strokeGeometry(stroke: Stroke): StrokeGeometry {
  const hit = cache.get(stroke);
  if (hit) return hit;
  const dense = catmullRom(stroke.points, DENSE_PER_SEGMENT);
  const geo: StrokeGeometry = {
    dense,
    collision: resample(dense, COLLISION_SPACING),
    bounds: boundsOf(dense),
  };
  cache.set(stroke, geo);
  return geo;
}

export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return { id: stroke.id, points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
}
