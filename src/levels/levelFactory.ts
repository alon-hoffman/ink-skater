import { CONTROL_SPACING, resample } from './geometry';
import type { Level, SpawnDirection, Stroke, Vec2 } from './levelTypes';

export const pt = (x: number, y: number): Vec2 => ({ x, y });

/** Centripetal Catmull-Rom through unevenly spaced anchors (no overshoot on long spans). */
export function smoothAnchors(anchors: readonly Vec2[], samplesPerSpan = 24): Vec2[] {
  if (anchors.length < 3) return anchors.map((p) => ({ ...p }));
  const out: Vec2[] = [];
  const n = anchors.length;
  const knot = (a: Vec2, b: Vec2, t: number): number =>
    t + Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5);
  for (let i = 0; i < n - 1; i++) {
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    if (!p1 || !p2) continue;
    const p0 = anchors[i - 1] ?? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = anchors[i + 2] ?? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
    const t0 = 0;
    const t1 = knot(p0, p1, t0);
    const t2 = knot(p1, p2, t1);
    const t3 = knot(p2, p3, t2);
    for (let s = 0; s < samplesPerSpan; s++) {
      const t = t1 + ((t2 - t1) * s) / samplesPerSpan;
      const lerp = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
        const k = tb === ta ? 0 : (t - ta) / (tb - ta);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      };
      const a1 = lerp(p0, p1, t0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      out.push(lerp(b1, b2, t1, t2));
    }
  }
  const last = anchors[n - 1];
  if (last) out.push({ ...last });
  return out;
}

/** Smooth curve through anchors, stored at the standard control-point spacing. */
export function curve(...anchors: [number, number][]): Vec2[] {
  return resample(smoothAnchors(anchors.map(([x, y]) => pt(x, y))), CONTROL_SPACING);
}

/** Straight segment stored at the standard spacing. */
export function line(x1: number, y1: number, x2: number, y2: number): Vec2[] {
  return resample([pt(x1, y1), pt(x2, y2)], CONTROL_SPACING);
}

/** Circular arc; angles in radians (0 = +x, positive = clockwise on screen). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): Vec2[] {
  const steps = Math.max(8, Math.ceil((Math.abs(a1 - a0) * r) / 6));
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return resample(pts, CONTROL_SPACING);
}

/** Join several pieces end-to-end into one continuous stroke (duplicate joints dropped). */
export function join(...pieces: Vec2[][]): Vec2[] {
  const out: Vec2[] = [];
  for (const piece of pieces) {
    for (const p of piece) {
      const last = out[out.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < 1) continue;
      out.push({ ...p });
    }
  }
  return resample(out, CONTROL_SPACING);
}

export const stroke = (id: string, points: Vec2[]): Stroke => ({ id, points });

/** Board-centre height for a skater standing on ground at `groundY`. */
export const spawnHeight = (groundY: number): number => groundY - 24;

export interface LevelSpec {
  id: string;
  name: string;
  difficulty: string;
  strokes: Stroke[];
  spawn: Vec2;
  flag: Vec2;
  spawnDirection?: SpawnDirection;
}

export function builtInLevel(spec: LevelSpec): Level {
  return {
    id: spec.id,
    name: spec.name,
    kind: 'builtin',
    strokes: spec.strokes,
    spawn: spec.spawn,
    spawnDirection: spec.spawnDirection ?? 1,
    flag: spec.flag,
    createdAt: 0,
    updatedAt: 0,
    revision: 1,
    validation: { validatedRevision: null, completionTime: null, validatedAt: null },
    difficulty: spec.difficulty,
  };
}
