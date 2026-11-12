import { describe, expect, it } from 'vitest';
import { longHaul } from '../src/levels/newLevelsLinedGraph';
import { runBot } from './bot';
import type { PlannedJump } from './bot';

const jumps = (list: [number, number][]): PlannedJump[] =>
  list.map(([at, charge]) => ({ at, charge }));

describe('Long Haul (builtin-16)', () => {
  it('can be finished with small hops over the three gaps', () => {
    const r = runBot(
      longHaul(),
      jumps([
        [2390, 0.3],
        [5390, 0.3],
        [8290, 0.3],
      ]),
      80,
    );
    expect(r.won).toBe(true);
    expect(r.deaths).toBe(0);
    expect(r.time).toBeGreaterThan(20);
  }, 30_000);
});
