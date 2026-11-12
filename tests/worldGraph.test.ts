import { describe, expect, it } from 'vitest';
import { graphCourses, graphLevels } from '../src/levels/worldGraph';
import { runBot } from './bot';

const courses = graphCourses();

describe('World 2: Graph Paper', () => {
  it('has six levels in play order with the finale last', () => {
    const levels = graphLevels();
    expect(levels.map((l) => l.id)).toEqual([
      'builtin-17',
      'builtin-28',
      'builtin-30',
      'builtin-29',
      'builtin-31',
      'builtin-18',
    ]);
    expect(levels[0]?.name).toBe('Stepping Stones');
    expect(levels[5]?.name).toBe('Canyon Run');
    expect(new Set(levels.map((l) => l.name)).size).toBe(6);
    for (const l of levels) expect(['Medium', 'Hard', 'Expert']).toContain(l.difficulty);
  });

  it('uses unique, well-formed strokes with the right id prefixes', () => {
    const seen = new Set<string>();
    for (const { level } of courses) {
      const prefix =
        level.id === 'builtin-17'
          ? 'l17-'
          : level.id === 'builtin-18'
            ? 'l18-'
            : `g${level.id.slice(8)}-`;
      for (const s of level.strokes) {
        expect(s.id.startsWith(prefix)).toBe(true);
        expect(seen.has(s.id)).toBe(false);
        seen.add(s.id);
        expect(s.points.length).toBeGreaterThan(2);
        const first = s.points[0];
        const last = s.points[s.points.length - 1];
        expect(
          Math.hypot((last?.x ?? 0) - (first?.x ?? 0), (last?.y ?? 0) - (first?.y ?? 0)),
        ).toBeGreaterThan(50);
      }
      expect(level.flag.x).toBeGreaterThan(level.spawn.x + 5000);
    }
  });

  for (const { level, jumps } of courses) {
    it(`${level.name} (${level.id}) can be finished cleanly in 60-110 s`, () => {
      const r = runBot(level, jumps, 160);
      console.info(
        `[worldGraph] ${level.id} ${level.name}: won=${r.won} deaths=${r.deaths} time=${r.time.toFixed(1)}s flag=${level.flag.x} ${r.deathPoints.join(';')}\n`,
      );
      expect(r.won).toBe(true);
      expect(r.deaths).toBe(0);
      expect(r.time).toBeGreaterThan(60);
      expect(r.time).toBeLessThan(110);
    }, 90_000);
  }

  it('gets longer toward the finale', () => {
    const flags = graphLevels().map((l) => l.flag.x);
    expect(flags[5]).toBeGreaterThan(flags[0] ?? 0);
  });
});
