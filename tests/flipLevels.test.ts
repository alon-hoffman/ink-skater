import { describe, expect, it } from 'vitest';
import type { Simulation } from '../src/game/Simulation';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { runScript } from './bot';
import type { ScriptStep } from './bot';

const x = (sim: Simulation) => sim.skateboard.board.position.x;
const atLeast = (v: number) => (sim: Simulation) => x(sim) >= v;
const atMost = (v: number) => (sim: Simulation) => x(sim) <= v;

const level = (id: string) => {
  const found = BUILT_IN_LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('levels that require turning around', () => {
  it('Switchback: turn at each dead end to reach the next drop', () => {
    const steps: ScriptStep[] = [
      { until: (s) => x(s) >= 1750 && s.grounded },
      { flip: true, until: atMost(-300) },
      { until: (s) => x(s) <= -400 && s.grounded },
      { flip: true, until: () => false },
    ];
    expect(runScript(level('builtin-7'), steps).won).toBe(true);
  });

  it('Zigzag: three turns and a gap', () => {
    const steps: ScriptStep[] = [
      { until: (s) => x(s) >= 1550 && s.skateboard.board.position.y > 200 && s.grounded },
      { flip: true, until: (s) => x(s) <= 40 },
      { until: (s) => s.skateboard.board.position.y > 480 && s.grounded && x(s) < 0 },
      { until: (s) => x(s) <= -550 },
      { flip: true, until: atLeast(110) },
      { crouch: true, until: atLeast(190) },
      { until: (s) => s.skateboard.board.position.y > 740 && s.grounded },
      { until: atLeast(2000) },
      { flip: true, until: () => false },
    ];
    expect(runScript(level('builtin-8'), steps).won).toBe(true);
  });

  it('Gauntlet: steps, a hop, a duck-and-leap, then a turn after the drop', () => {
    const steps: ScriptStep[] = [
      { until: atLeast(400) },
      { crouch: true, until: atLeast(470) },
      { until: atLeast(850) },
      { crouch: true, until: atLeast(920) },
      { until: atLeast(1650) },
      { crouch: true, until: atLeast(1670) },
      { until: atLeast(2400) },
      { crouch: true, until: atLeast(2910) },
      { until: (s) => s.skateboard.board.position.y > 50 && s.grounded && x(s) > 4300 },
      { until: atLeast(4450) },
      { flip: true, until: () => false },
    ];
    expect(runScript(level('builtin-13'), steps).won).toBe(true);
  });
});
