import { describe, expect, it } from 'vitest';
import { notebookCourses, notebookLevels } from '../src/levels/worldNotebook';
import { runBot } from './bot';

describe('Notebook world levels', () => {
  it('has five levels with the expected ids', () => {
    expect(notebookLevels().map((l) => l.id)).toEqual([
      'builtin-23',
      'builtin-24',
      'builtin-25',
      'builtin-26',
      'builtin-27',
    ]);
  });

  it('uses unique stroke ids with the n23-..n27- prefixes and no degenerate strokes', () => {
    const ids = new Set<string>();
    for (const l of notebookLevels()) {
      const prefix = `n${l.id.split('-')[1]}-`;
      for (const s of l.strokes) {
        expect(s.id.startsWith(prefix)).toBe(true);
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        expect(s.points.length).toBeGreaterThan(2);
      }
    }
  });

  notebookCourses().forEach((c) => {
    it(`${c.level.name} (${c.level.id}) can be finished cleanly by the bot`, () => {
      const r = runBot(c.level, c.jumps, 90);
      console.log(
        `${c.level.id} ${c.level.name}: flagX=${c.level.flag.x} time=${r.time.toFixed(1)}s deaths=${r.deaths} ${r.deathPoints.join(' | ')}`,
      );
      expect(r.won).toBe(true);
      expect(r.deaths).toBe(0);
      expect(r.time).toBeGreaterThan(20);
      expect(r.time).toBeLessThan(55);
    }, 90_000);
  });
});
