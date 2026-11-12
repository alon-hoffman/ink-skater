import { describe, expect, it } from 'vitest';
import { computeDeathY } from '../src/game/Terrain';
import { legalLevels, legalPlans } from '../src/levels/worldLegal';
import { runScript } from './bot';

const plans = legalPlans();

describe('World 3 Legal Pad levels', () => {
  it('lists six levels, finale last, with the expected ids and names', () => {
    expect(legalLevels().map((l) => l.id)).toEqual([
      'builtin-32',
      'builtin-33',
      'builtin-34',
      'builtin-35',
      'builtin-36',
      'builtin-19',
    ]);
    expect(legalLevels().at(-1)?.name).toBe('Long Tunnel');
  });

  describe.each(plans.map((p) => [p.level.id, p] as const))('%s', (_id, plan) => {
    const lvl = plan.level;
    it('has unique, non-degenerate strokes and a safe death floor', () => {
      const ids = lvl.strokes.map((st) => st.id);
      expect(new Set(ids).size).toBe(ids.length);
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
    });

    it('is cleanly finished by the bot', () => {
      const r = runScript(lvl, plan.steps, 150);
      console.log(
        `${lvl.id} ${lvl.name} flag.x=${lvl.flag.x} time=${r.time.toFixed(1)}s deaths=${r.deaths} ${r.deathPoints.slice(0, 3).join(' | ')}`,
      );
      expect(r).toMatchObject({ won: true, deaths: 0 });
      expect(r.time).toBeGreaterThan(50);
      expect(r.time).toBeLessThan(125);
    }, 90_000);
  });
});
