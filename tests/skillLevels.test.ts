import { describe, expect, it } from 'vitest';
import type { Simulation } from '../src/game/Simulation';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { runBot, runScript } from './bot';
import type { ScriptStep } from './bot';

const x = (sim: Simulation) => sim.skateboard.board.position.x;
const y = (sim: Simulation) => sim.skateboard.board.position.y;
const atLeast = (v: number) => (sim: Simulation) => x(sim) >= v;
const never = () => false;

const level = (id: string) => {
  const found = BUILT_IN_LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('Stairway', () => {
  it('can be climbed with a jump before each riser', () => {
    const steps: ScriptStep[] = [0, 1, 2, 3].flatMap((k) => [
      { until: atLeast(700 + 450 * k - 230) },
      { crouch: true, until: atLeast(700 + 450 * k - 130) },
    ]);
    expect(runScript(level('builtin-9'), [...steps, { until: never }], 30).won).toBe(true);
  });

  it('a missed step stops you without killing you; back up and try again', () => {
    let climbed = false;
    const steps: ScriptStep[] = [
      { until: (s) => s.ticks > 300 },
      { flip: true, until: (s) => x(s) < 450 },
      { flip: true, until: atLeast(500) },
      { crouch: true, until: atLeast(570) },
      { until: (s) => (climbed = y(s) < -100 && s.grounded) },
    ];
    const result = runScript(level('builtin-9'), steps, 12);
    expect(result.deaths).toBe(0);
    expect(climbed).toBe(true);
  });
});

describe('Ski Jump', () => {
  it('lands with the air stabiliser, with or without a jump at the lip', () => {
    expect(runScript(level('builtin-10'), [{ until: never }], 15).won).toBe(true);
    const jump: ScriptStep[] = [
      { until: atLeast(1250) },
      { crouch: true, until: atLeast(1410) },
      { until: never },
    ];
    expect(runScript(level('builtin-10'), jump, 15).won).toBe(true);
  });

  it('crashes without tilting: the lip kicks the nose up', () => {
    const result = runScript(level('builtin-10'), [{ noStabilize: true, until: never }], 8);
    expect(result.won).toBe(false);
    expect(result.deaths).toBeGreaterThan(0);
  });
});

describe('Low Ceiling', () => {
  const lowCeiling = (hold: number, release: number): ScriptStep[] => [
    { until: atLeast(1070 - hold) },
    { crouch: true, until: atLeast(1070) },
    { until: atLeast(1670 - hold) },
    { crouch: true, until: atLeast(1670) },
    { until: atLeast(1900) },
    { crouch: true, until: atLeast(release) },
    { until: never },
  ];

  it('quick hops under the roof, then duck and leap', () => {
    const result = runScript(level('builtin-11'), lowCeiling(20, 2565), 20);
    expect(result).toMatchObject({ won: true, deaths: 0 });
  });

  it('a full jump under the roof hits your head', () => {
    const result = runScript(level('builtin-11'), lowCeiling(60, 2565), 8);
    expect(result.deathPoints[0]).toMatch(/^head/);
  });

  it('standing up under the slab hits your head', () => {
    const result = runScript(level('builtin-11'), lowCeiling(20, 2400), 14);
    expect(result.won).toBe(false);
    expect(result.deathPoints[0]).toMatch(/^head/);
  });
});

describe('Downhill Rush', () => {
  it('can be finished with strong, late jumps', () => {
    const plan = [
      { at: 1100, charge: 0.7 },
      { at: 1940, charge: 0.7 },
      { at: 2960, charge: 0.7 },
      { at: 4040, charge: 0.7 },
    ];
    expect(runBot(level('builtin-12'), plan, 40).won).toBe(true);
  }, 30_000);

  it('weak hops get you over the first gaps but not the last ones', () => {
    const plan = [1300, 2100, 3000, 4100].map((at) => ({ at, charge: 0.05 }));
    expect(runBot(level('builtin-12'), plan, 25).won).toBe(false);
  }, 30_000);
});
