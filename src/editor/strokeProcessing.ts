import {
  CONTROL_SPACING,
  catmullRom,
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
  // Always finish exactly where the pen lifted (the last kept sample may be a few units short).
  const end = points[points.length - 1];
  if (end && out.length > 1) out[out.length - 1] = { x: end.x, y: end.y };
  return out;
}

/** Spacing of the fine intermediate resample that smoothing runs on. */
const SMOOTH_SPACING = 4;
/** Gaussian sigma (world units) of the low-pass; effective feature scale is roughly 2.5x this. */
const SMOOTH_SIGMA = 24;
/** A run of same-sign turning with a smaller total angle than this (radians) is treated as hand noise. */
const NOISE_TURN = 0.45;
/** Binomial passes over the turning-angle sequence after noise removal. */
const TURN_SMOOTH_PASSES = 4;

/** Gaussian low-pass with odd reflection at the ends, so both endpoints stay exactly pinned. */
function gaussianSmooth(points: readonly Vec2[], spacing: number, sigma: number): Vec2[] {
  const n = points.length;
  const first = points[0];
  const last = points[n - 1];
  if (n < 3 || !first || !last) return points.map((p) => ({ ...p }));
  const half = Math.ceil((3 * sigma) / spacing);
  const weights: number[] = [];
  let wsum = 0;
  for (let k = -half; k <= half; k++) {
    const w = Math.exp(-0.5 * ((k * spacing) / sigma) ** 2);
    weights.push(w);
    wsum += w;
  }
  const at = (j: number): Vec2 => {
    if (j < 0) {
      const q = points[Math.min(-j, n - 1)] ?? first;
      return { x: 2 * first.x - q.x, y: 2 * first.y - q.y };
    }
    if (j > n - 1) {
      const q = points[Math.max(2 * (n - 1) - j, 0)] ?? last;
      return { x: 2 * last.x - q.x, y: 2 * last.y - q.y };
    }
    return points[j] ?? first;
  };
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let k = -half; k <= half; k++) {
      const w = weights[k + half] ?? 0;
      const q = at(i + k);
      x += w * q.x;
      y += w * q.y;
    }
    out.push({ x: x / wsum, y: y / wsum });
  }
  out[0] = { ...first };
  out[n - 1] = { ...last };
  return out;
}

/** Number of curvature sign changes along a polyline (collinear triples ignored). */
function countFlips(line: readonly Vec2[]): number {
  let last = 0;
  let changes = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1];
    const b = line[i];
    const c = line[i + 1];
    if (!a || !b || !c) continue;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const sign = Math.sign(cross);
    if (last !== 0 && sign !== last) changes++;
    last = sign;
  }
  return changes;
}

/**
 * Remove curvature sign flips that are just hand wobble. The polyline is described by edge
 * headings; runs of same-sign turning whose total angle is below NOISE_TURN are damped and
 * given the sign of the stronger neighbouring run, so shallow bumps on a valley disappear while
 * deliberate S-curves and corners (large turning) survive. The shape is rebuilt from the edited
 * headings and fitted back onto the original endpoints with a similarity transform.
 */
function enforceCurvature(points: readonly Vec2[]): Vec2[] {
  const n = points.length;
  const first = points[0];
  const last = points[n - 1];
  if (n < 4 || !first || !last) return points.map((p) => ({ ...p }));
  const lens: number[] = [];
  const heads: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) return points.map((p) => ({ ...p }));
    lens.push(Math.hypot(b.x - a.x, b.y - a.y));
    heads.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  // Turning angle at each interior point, wrapped to (-PI, PI].
  const turns: number[] = [];
  for (let i = 1; i < heads.length; i++) {
    let d = (heads[i] ?? 0) - (heads[i - 1] ?? 0);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    turns.push(d);
  }
  interface Run {
    sign: number;
    start: number;
    end: number; // inclusive
  }
  const buildRuns = (): Run[] => {
    const runs: Run[] = [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i] ?? 0;
      const sign = t >= 0 ? 1 : -1;
      const cur = runs[runs.length - 1];
      if (cur && (cur.sign === sign || Math.abs(t) < 1e-9)) cur.end = i;
      else runs.push({ sign, start: i, end: i });
    }
    return runs;
  };
  const sumOf = (r: Run): number => {
    let s = 0;
    for (let i = r.start; i <= r.end; i++) s += Math.abs(turns[i] ?? 0);
    return s;
  };
  for (let guard = 0; guard < turns.length + 2; guard++) {
    const runs = buildRuns();
    if (runs.length < 2) break;
    let idx = -1;
    let best = NOISE_TURN;
    runs.forEach((r, k) => {
      const s = sumOf(r);
      if (s < best) {
        best = s;
        idx = k;
      }
    });
    if (idx < 0) break;
    const r = runs[idx];
    if (!r) break;
    const prev = runs[idx - 1];
    const next = runs[idx + 1];
    const target = prev && next ? (sumOf(prev) >= sumOf(next) ? prev : next) : (prev ?? next);
    if (!target) break;
    for (let i = r.start; i <= r.end; i++) turns[i] = target.sign * 0.02 * Math.abs(turns[i] ?? 0);
  }
  // Even out the turning so the spline through the points cannot ripple between uneven turns.
  const rebuild = (passes: number): Vec2[] => {
    const turnsCopy = turns.slice();
    for (let pass = 0; pass < passes; pass++) {
      const prev = turnsCopy.slice();
      for (let i = 0; i < turns.length; i++) {
        const a = prev[Math.max(i - 1, 0)] ?? 0;
        const b = prev[i] ?? 0;
        const c = prev[Math.min(i + 1, turns.length - 1)] ?? 0;
        turnsCopy[i] = (a + 2 * b + c) / 4;
      }
    }
    let h = heads[0] ?? 0;
    const rebuilt: Vec2[] = [{ ...first }];
    for (let i = 0; i < lens.length; i++) {
      if (i > 0) h += turnsCopy[i - 1] ?? 0;
      const p = rebuilt[i];
      if (!p) break;
      rebuilt.push({
        x: p.x + Math.cos(h) * (lens[i] ?? 0),
        y: p.y + Math.sin(h) * (lens[i] ?? 0),
      });
    }
    const end = rebuilt[rebuilt.length - 1];
    if (!end) return points.map((p) => ({ ...p }));
    const ox = last.x - first.x;
    const oy = last.y - first.y;
    const rx = end.x - first.x;
    const ry = end.y - first.y;
    const rl = Math.hypot(rx, ry);
    if (rl < 1e-6 || Math.hypot(ox, oy) < 1e-6) return rebuilt;
    const scale = Math.hypot(ox, oy) / rl;
    const rot = Math.atan2(oy, ox) - Math.atan2(ry, rx);
    const c = Math.cos(rot) * scale;
    const s = Math.sin(rot) * scale;
    const out = rebuilt.map((p) => {
      const dx = p.x - first.x;
      const dy = p.y - first.y;
      return { x: first.x + dx * c - dy * s, y: first.y + dx * s + dy * c };
    });
    out[0] = { ...first };
    out[out.length - 1] = { ...last };
    return out;
  };
  const allowed = buildRuns().length - 1;
  let result = rebuild(TURN_SMOOTH_PASSES);
  for (let extra = 0; extra < 40; extra++) {
    if (countFlips(result) <= allowed && countFlips(catmullRom(result, 5)) <= allowed) break;
    result = rebuild(TURN_SMOOTH_PASSES + 2 * (extra + 1));
  }
  return result;
}

/**
 * Raw samples -> control points at `spacing`: fine even resample (jitter is filtered by distance,
 * not pointer rate), Gaussian low-pass with endpoints pinned, resample, then curvature clean-up.
 */
function fitControlPoints(cleaned: readonly Vec2[], spacing: number): Vec2[] {
  if (cleaned.length < 3) return cleaned.map((p) => ({ ...p }));
  const smoothed = gaussianSmooth(resample(cleaned, SMOOTH_SPACING), SMOOTH_SPACING, SMOOTH_SIGMA);
  return enforceCurvature(resample(smoothed, spacing));
}

/** Smoothed curve for the live preview: the same fit and spline the committed stroke gets. */
export function previewFreehand(raw: readonly Vec2[]): Vec2[] {
  return catmullRom(fitControlPoints(dropDuplicates(raw, 1.5), CONTROL_SPACING), 5);
}

/**
 * Turn raw pointer samples into stroke control points: de-duplicated, smoothed and resampled
 * to an even spacing so the generated physics geometry stays small and rideable.
 * Returns null for taps and scribbles too short to ride.
 */
export function processFreehand(raw: readonly Vec2[]): Vec2[] | null {
  const cleaned = dropDuplicates(raw, 1.5);
  if (cleaned.length < 2 || pathLength(cleaned) < MIN_STROKE_LENGTH) return null;
  let spacing = CONTROL_SPACING;
  let points = fitControlPoints(cleaned, spacing);
  while (points.length > MAX_POINTS_PER_STROKE) {
    spacing *= 1.5;
    points = fitControlPoints(cleaned, spacing);
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
