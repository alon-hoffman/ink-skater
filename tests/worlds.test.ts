import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/game/Simulation';
import type { TrickEvent } from '../src/game/TrickTracker';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { MemoryStorage, createLocalRepositories } from '../src/levels/localLevelRepository';
import { evaluateObjectives, knownProgress, mergeProgress } from '../src/levels/objectives';
import { WORLDS, isWorldUnlocked, worldOfLevel } from '../src/levels/worlds';

describe('objectives', () => {
  const targets = { timeLimit: 40, scoreTarget: 300 };

  it('E6: fast and high score ticks all three', () => {
    expect(evaluateObjectives(targets, 35, 350)).toEqual({ finish: true, time: true, score: true });
  });

  it('E7: slow finish misses only the time objective', () => {
    expect(evaluateObjectives(targets, 50, 350)).toEqual({
      finish: true,
      time: false,
      score: true,
    });
  });

  it('E8: low score misses only the score objective', () => {
    expect(evaluateObjectives(targets, 35, 100)).toEqual({
      finish: true,
      time: true,
      score: false,
    });
  });

  it('a limit and a target that are met exactly count', () => {
    expect(evaluateObjectives(targets, 40, 300)).toEqual({ finish: true, time: true, score: true });
  });

  it('levels without objectives (custom levels) only report finish', () => {
    expect(evaluateObjectives(undefined, 1, 99999)).toEqual({
      finish: true,
      time: false,
      score: false,
    });
  });

  it('E9: ticked objectives stay ticked and the best score only goes up', () => {
    const first = mergeProgress(undefined, { finish: true, time: true, score: false }, 120);
    const worse = mergeProgress(first, { finish: true, time: false, score: false }, 40);
    expect(worse).toEqual({ finish: true, time: true, score: false, bestScore: 120 });
    const better = mergeProgress(worse, { finish: true, time: false, score: true }, 400);
    expect(better).toEqual({ finish: true, time: true, score: true, bestScore: 400 });
  });
});

describe('progress storage', () => {
  it('saves per level, merges, and survives corrupted storage', async () => {
    const storage = new MemoryStorage();
    const repos = createLocalRepositories(storage);
    await repos.progress.submit('builtin-1', { finish: true, time: false, score: true }, 200);
    await repos.progress.submit('builtin-1', { finish: true, time: true, score: false }, 50);
    expect((await repos.progress.getAll())['builtin-1']).toEqual({
      finish: true,
      time: true,
      score: true,
      bestScore: 200,
    });
    storage.setItem('inkskater.progress.v1', '{{{');
    expect(await repos.progress.getAll()).toEqual({});
  });
});

describe('worlds', () => {
  it('there are four worlds holding 37 built-in levels: 10, 9, 10 and 8', () => {
    expect(WORLDS.map((w) => w.paper)).toEqual(['lined', 'graph', 'legal', 'blueprint']);
    expect(WORLDS.map((w) => w.levelIds.length)).toEqual([10, 9, 10, 8]);
    expect(BUILT_IN_LEVELS).toHaveLength(37);
    expect(new Set(BUILT_IN_LEVELS.map((l) => l.id)).size).toBe(37);
  });

  it('every level belongs to exactly one world and has objectives', () => {
    for (const level of BUILT_IN_LEVELS) {
      expect(worldOfLevel(level.id)?.id, level.id).toBe(level.worldId);
      expect(level.objectives, level.id).toBeDefined();
      expect(level.objectives?.timeLimit).toBeGreaterThan(0);
      expect(level.objectives?.scoreTarget).toBeGreaterThan(0);
    }
  });

  it('the level list is ordered world by world', () => {
    expect(BUILT_IN_LEVELS.map((l) => l.id)).toEqual(WORLDS.flatMap((w) => [...w.levelIds]));
  });

  it('E10/E11: only world 1 is open until a world finale is finished', () => {
    const none = new Set<string>();
    expect(WORLDS.map((_, i) => isWorldUnlocked(i, none))).toEqual([true, false, false, false]);
    const finale1 = WORLDS[0]!.levelIds.at(-1)!;
    expect(isWorldUnlocked(1, new Set([finale1]))).toBe(true);
    expect(isWorldUnlocked(2, new Set([finale1]))).toBe(false);
    // finishing an early level of a world does not open the next one
    expect(isWorldUnlocked(1, new Set(['builtin-1']))).toBe(false);
  });

  it('the finale of each world is much longer than the first level of world 1', () => {
    const firstRideFlag = BUILT_IN_LEVELS.find((l) => l.id === 'builtin-1')!.flag.x;
    for (const w of WORLDS) {
      const finale = BUILT_IN_LEVELS.find((l) => l.id === w.levelIds.at(-1))!;
      expect(finale.flag.x, finale.name).toBeGreaterThan(firstRideFlag * 2.5);
    }
  });
});

describe('tricks in the real physics', () => {
  /** Hold a one-wheel balance on the first level and report what scored. */
  function ride(seconds: number): { events: TrickEvent[]; score: number } {
    const level = BUILT_IN_LEVELS.find((l) => l.id === 'builtin-1')!;
    const events: TrickEvent[] = [];
    const sim = new Simulation(level, { onTrick: (e) => events.push(e) });
    for (let i = 0; i < 120; i++) sim.step({ tilt: 0, crouch: false, flip: false });
    for (let i = 0; i < seconds * 60; i++) {
      const a = sim.skateboard.board.angle;
      const pulse = i < 14;
      const tilt = pulse ? -1 : a > 0.45 ? -1 : a < 0.25 ? 1 : 0;
      sim.step({ tilt, crouch: false, flip: false });
    }
    // level out so the manual ends and banks
    for (let i = 0; i < 90; i++) {
      const a = sim.skateboard.board.angle;
      sim.step({ tilt: a > 0.1 ? -1 : a < -0.1 ? 1 : 0, crouch: false, flip: false });
    }
    const score = sim.score;
    sim.dispose();
    return { events, score };
  }

  it('E4: riding one wheel for a few seconds banks a manual', () => {
    const { events } = ride(3);
    const manuals = events.filter((e) => e.kind === 'manual');
    expect(manuals.length).toBeGreaterThan(0);
    expect(manuals.reduce((n, e) => n + e.points, 0)).toBeGreaterThanOrEqual(75);
  });

  it('E2: a charged jump with a full spin reports a flip when it lands', () => {
    const level = BUILT_IN_LEVELS.find((l) => l.id === 'builtin-9')!;
    const events: TrickEvent[] = [];
    const sim = new Simulation(level, { onTrick: (e) => events.push(e) });
    for (let i = 0; i < 90; i++) sim.step({ tilt: 0, crouch: false, flip: false });
    for (let i = 0; i < 40; i++) sim.step({ tilt: 0, crouch: true, flip: false });
    for (let i = 0; i < 200; i++) {
      sim.step({ tilt: sim.grounded ? 0 : 1, crouch: false, flip: false });
    }
    sim.dispose();
    expect(events.some((e) => e.kind === 'flip')).toBe(true);
  });

  it('E3: a crash restarts the run with zero points', () => {
    const level = BUILT_IN_LEVELS.find((l) => l.id === 'builtin-1')!;
    const sim = new Simulation(level, {});
    for (let i = 0; i < 120; i++) sim.step({ tilt: 0, crouch: false, flip: false });
    sim.tricks.score = 250;
    // steer into the ground until the head touches
    for (let i = 0; i < 600 && sim.deaths === 0; i++)
      sim.step({ tilt: 1, crouch: false, flip: false });
    expect(sim.deaths).toBeGreaterThan(0);
    expect(sim.score).toBe(0);
    sim.dispose();
  });

  it('E5: plain riding with no tricks earns no points', () => {
    const level = BUILT_IN_LEVELS.find((l) => l.id === 'builtin-1')!;
    const events: TrickEvent[] = [];
    const sim = new Simulation(level, { onTrick: (e) => events.push(e) });
    for (let i = 0; i < 60 * 25 && sim.status === 'running'; i++) {
      sim.step({ tilt: 0, crouch: false, flip: false });
    }
    expect(sim.status).toBe('won');
    expect(sim.score).toBe(0);
    expect(events).toHaveLength(0);
    sim.dispose();
  });
});

describe('old saves (best time only)', () => {
  const targets = { timeLimit: 11, scoreTarget: 100 };

  it('a best time proves Finish, and the time objective when it is within the limit', () => {
    expect(knownProgress(targets, 7.2, undefined)).toEqual({
      finish: true,
      time: true,
      score: false,
      bestScore: 0,
    });
    expect(knownProgress(targets, 15, undefined)).toMatchObject({ finish: true, time: false });
  });

  it('keeps what was saved and never invents a score objective', () => {
    const saved = { finish: true, time: false, score: true, bestScore: 300 };
    expect(knownProgress(targets, 20, saved)).toEqual(saved);
    expect(knownProgress(targets, undefined, saved)).toBe(saved);
    expect(knownProgress(targets, null, undefined)).toBeUndefined();
  });
});
