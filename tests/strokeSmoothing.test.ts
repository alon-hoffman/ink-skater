import { describe, expect, it } from 'vitest';
import { EditorSession } from '../src/editor/EditorSession';
import { addStroke } from '../src/editor/editorCommands';
import { createStroke, previewFreehand, processFreehand } from '../src/editor/strokeProcessing';
import { strokeGeometry } from '../src/levels/geometry';
import type { Vec2 } from '../src/levels/levelTypes';
import { newCustomLevel } from '../src/levels/levelValidation';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function need<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

/** Sample `fn` along x every `step` units and add +-`amp` jitter on both axes. */
function noisy(fn: (t: number) => Vec2, step: number, count: number, amp: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const p = fn(i / (count - 1));
    return { x: p.x + (r() * 2 - 1) * amp, y: p.y + (r() * 2 - 1) * amp };
  }).map((p, i, a) => (i === 0 || i === a.length - 1 ? fn(i === 0 ? 0 : 1) : p)) as Vec2[] & {
    length: number;
  };
  void step;
}

function signChanges(line: readonly Vec2[]): number {
  let last = 0;
  let changes = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const a = need(line[i - 1]);
    const b = need(line[i]);
    const c = need(line[i + 1]);
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (last !== 0 && s !== last) changes++;
    last = s;
  }
  return changes;
}

function totalTurn(line: readonly Vec2[]): number {
  let t = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const a = need(line[i - 1]);
    const b = need(line[i]);
    const c = need(line[i + 1]);
    t += Math.abs(
      Math.atan2(
        (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
        (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y),
      ),
    );
  }
  return t;
}

const valley = (t: number): Vec2 => ({ x: t * 400, y: 80 * Math.sin(Math.PI * t) }); // y down: bowl
const hill = (t: number): Vec2 => ({ x: t * 400, y: -80 * Math.sin(Math.PI * t) });
const ramp = (t: number): Vec2 => ({ x: t * 400, y: t * 100 });

describe('freehand curvature consistency', () => {
  for (const [name, fn] of [
    ['concave valley', valley],
    ['convex hill', hill],
    ['bumpy ramp', ramp],
  ] as const) {
    for (const amp of [3, 5]) {
      it(`${name} with +-${amp} jitter has no curvature sign changes`, () => {
        for (let seed = 1; seed <= 20; seed++) {
          const raw = noisy(fn, 3, 200, amp, seed);
          const pts = need(processFreehand(raw));
          expect(pts[0]).toEqual(raw[0]);
          expect(pts[pts.length - 1]).toEqual(raw[raw.length - 1]);
          expect(signChanges(pts)).toBe(0);
          const dense = strokeGeometry({ id: 's', points: pts }).dense;
          expect(signChanges(dense)).toBe(0);
          expect(signChanges(strokeGeometry({ id: 's', points: pts }).collision)).toBe(0);
          expect(signChanges(previewFreehand(raw))).toBe(0);
        }
      });
    }
  }

  it('keeps the valley shape roughly where the user drew it', () => {
    const pts = need(processFreehand(noisy(valley, 3, 200, 4, 7)));
    const mid = need(pts[Math.floor(pts.length / 2)]);
    expect(mid.y).toBeGreaterThan(60);
    expect(mid.y).toBeLessThan(95);
  });

  it('keeps a deliberate sharp corner', () => {
    const corner = (t: number): Vec2 =>
      t < 0.5 ? { x: t * 400, y: t * 200 } : { x: 200 + (t - 0.5) * 400, y: 100 - (t - 0.5) * 200 };
    const raw = noisy(corner, 3, 200, 3, 3);
    const pts = need(processFreehand(raw));
    // Corner turns ~53 degrees; it must remain a strong, concentrated turn.
    expect(totalTurn(pts)).toBeGreaterThan(0.7);
    const apex = pts.reduce((m, p) => (p.y > m.y ? p : m), need(pts[0]));
    expect(apex.y).toBeGreaterThan(80);
  });

  it('keeps a deliberate S-curve (one curvature flip)', () => {
    const s = (t: number): Vec2 => ({ x: t * 500, y: 70 * Math.sin(2 * Math.PI * t) });
    for (let seed = 1; seed <= 10; seed++) {
      const pts = need(processFreehand(noisy(s, 3, 250, 3, seed)));
      expect(signChanges(pts)).toBe(1);
      const ys = pts.map((p) => p.y);
      expect(Math.max(...ys)).toBeGreaterThan(45);
      expect(Math.min(...ys)).toBeLessThan(-45);
    }
  });

  it('still lets a smoothed stroke be added to a level that validates', () => {
    const stroke = need(createStroke(noisy(valley, 3, 200, 4, 11)));
    const session = new EditorSession(newCustomLevel({ id: 'e', name: 'E', now: 1 }), () => 1000);
    session.edit(addStroke(session.content, stroke));
    expect(session.validate({ revision: session.level.revision, time: 4 })).toBe(true);
  });
});
