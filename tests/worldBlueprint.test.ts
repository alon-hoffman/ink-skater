import { describe, expect, it } from 'vitest';
import type { Simulation } from '../src/game/Simulation';
import { computeDeathY } from '../src/game/Terrain';
import { blueprintLevels, blueprintPlans } from '../src/levels/worldBlueprint';
import { runScript } from './bot';
import type { ScriptStep } from './bot';

const px = (sim: Simulation) => sim.skateboard.board.position.x;

/** Crouch shortly before each planned lip and release at it (a longer lead at high speed). */
const hopSteps = (hops: number[]): ScriptStep[] => [
  ...[...hops]
    .sort((a, b) => a - b)
    .flatMap((edge): ScriptStep[] => [
      { until: (s) => px(s) >= edge - 50 - Math.max(120, s.speed * 0.17) },
      { crouch: true, until: (s) => px(s) >= edge - 50 },
    ]),
  { until: () => false },
];

const EXPECTED: [string, string][] = [
  ['builtin-20', 'Launch Pad'],
  ['builtin-37', 'Ski Jump Chain'],
  ['builtin-21', 'Halfpipe Hop'],
  ['builtin-38', 'Switchback Peak'],
  ['builtin-39', 'Redline Rhythm'],
  ['builtin-22', 'Sky Marathon'],
];

describe('World 4 (Blueprint) levels', () => {
  const levels = blueprintLevels();

  it('returns six levels in play order with Sky Marathon as the finale', () => {
    expect(levels.map((l) => l.id)).toEqual(EXPECTED.map((e) => e[0]));
    expect(levels.map((l) => l.name)).toEqual(EXPECTED.map((e) => e[1]));
    expect(levels[levels.length - 1]?.name).toBe('Sky Marathon');
    for (const l of levels) expect(['Medium', 'Hard', 'Expert']).toContain(l.difficulty);
  });

  it('has globally unique stroke ids with the right prefixes', () => {
    const all = levels.flatMap((l) => l.strokes.map((s) => s.id));
    expect(new Set(all).size).toBe(all.length);
    const prefix: Record<string, string> = {
      'builtin-20': 'l20-',
      'builtin-21': 'l21-',
      'builtin-22': 'l22-',
      'builtin-37': 'b37-',
      'builtin-38': 'b38-',
      'builtin-39': 'b39-',
    };
    for (const l of levels)
      for (const s of l.strokes) expect(s.id.startsWith(prefix[l.id] ?? '?'), s.id).toBe(true);
  });

  it.each(levels.map((l) => [l.id, l] as const))(
    '%s is long, with non-degenerate strokes and a safe death floor',
    (_id, lvl) => {
      expect(lvl.flag.x).toBeGreaterThanOrEqual(12000);
      for (const st of lvl.strokes) {
        expect(st.points.length, st.id).toBeGreaterThanOrEqual(2);
        for (let k = 1; k < st.points.length; k++) {
          const a = st.points[k - 1];
          const b = st.points[k];
          if (a && b) expect(Math.hypot(a.x - b.x, a.y - b.y), st.id).toBeGreaterThan(0.5);
        }
      }
      const lowestY = Math.max(...lvl.strokes.flatMap((st) => st.points.map((p) => p.y)));
      expect(computeDeathY(lvl)).toBeGreaterThan(lowestY + 500);
    },
  );

  it.each(blueprintPlans().map((p) => [p.level.id, p] as const))(
    '%s is finished cleanly by the autopilot',
    (_id, plan) => {
      const r = runScript(plan.level, hopSteps(plan.hops), 150);
      console.log(`${plan.level.name} (${plan.level.id}) finish time ${r.time.toFixed(1)} s`);
      expect(r).toMatchObject({ won: true, deaths: 0 });
      expect(r.time).toBeGreaterThan(30);
      expect(r.time).toBeLessThan(125);
    },
    90_000,
  );
});
