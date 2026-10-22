import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import type { InputSample } from '../src/game/InputState';
import { Simulation } from '../src/game/Simulation';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { builtInLevel, line, pt, spawnHeight, stroke } from '../src/levels/levelFactory';
import type { Level } from '../src/levels/levelTypes';
import { runBot } from './bot';
import type { PlannedJump } from './bot';

const idle: InputSample = { tilt: 0, crouch: false };

function flat(): Level {
  return builtInLevel({
    id: 'flat',
    name: 'flat',
    difficulty: '',
    strokes: [stroke('g', line(0, 500, 9000, 500))],
    spawn: pt(60, spawnHeight(500)),
    flag: pt(8900, 500),
  });
}

function run(sim: Simulation, ticks: number, input: InputSample = idle): void {
  for (let i = 0; i < ticks; i++) sim.step(input);
}

describe('skateboard physics', () => {
  it('rolls forward on its own and settles on both wheels', () => {
    const sim = new Simulation(flat());
    run(sim, 120);
    expect(sim.skateboard.board.position.x).toBeGreaterThan(150);
    expect(sim.contacts.wheel('front').grounded).toBe(true);
    expect(sim.contacts.wheel('rear').grounded).toBe(true);
    expect(sim.speed).toBeGreaterThan(100);
    sim.dispose();
  });

  it('starts airborne when spawned in midair and falls to the ground', () => {
    const level = { ...flat(), spawn: pt(60, 200) };
    const sim = new Simulation(level);
    run(sim, 5);
    expect(sim.grounded).toBe(false);
    run(sim, 120);
    expect(sim.grounded).toBe(true);
    sim.dispose();
  });

  it('jumping fires once per release and leaves the ground', () => {
    let jumps = 0;
    const sim = new Simulation(flat(), { onJump: () => jumps++ });
    run(sim, 90);
    run(sim, 30, { tilt: 0, crouch: true });
    run(sim, 60);
    expect(jumps).toBe(1);
    sim.dispose();
  });

  it('a jump launches clear of the ground, and releasing in midair does nothing', () => {
    let jumps = 0;
    const sim = new Simulation(flat(), { onJump: () => jumps++ });
    run(sim, 90);
    run(sim, 30, { tilt: 0, crouch: true });
    run(sim, 4);
    expect(sim.grounded).toBe(false);
    run(sim, 1, { tilt: 0, crouch: true });
    run(sim, 1);
    expect(jumps).toBe(1);
    sim.dispose();
  });

  it('keeps angular momentum in the air and tilt can reverse it', () => {
    const sim = new Simulation({ ...flat(), spawn: pt(60, -400) });
    run(sim, 10);
    expect(sim.grounded).toBe(false);
    run(sim, 15, { tilt: 1, crouch: false });
    const spinning = sim.skateboard.angularVelocity();
    expect(spinning).toBeGreaterThan(0.01);
    run(sim, 10);
    expect(sim.skateboard.angularVelocity()).toBeCloseTo(spinning, 2);
    run(sim, 40, { tilt: -1, crouch: false });
    expect(sim.skateboard.angularVelocity()).toBeLessThan(spinning);
    sim.dispose();
  });

  it('a short counterclockwise tilt lifts the front wheel (manual) while the rear stays down', () => {
    const sim = new Simulation(flat());
    run(sim, 120);
    let frontUp = false;
    for (let i = 0; i < 12; i++) {
      sim.step({ tilt: -1, crouch: false });
      if (!sim.contacts.wheel('front').grounded && sim.contacts.wheel('rear').grounded)
        frontUp = true;
    }
    expect(frontUp).toBe(true);
    sim.dispose();
  });

  it('dies from the head touching terrain, not from board or wheel contact', () => {
    const causes: string[] = [];
    // Flip the assembly upside down in the air and drop it: the head reaches the ground first.
    const sim = new Simulation(
      { ...flat(), spawn: pt(60, 300) },
      { onDeath: (c) => causes.push(c) },
    );
    run(sim, 5);
    expect(causes).toEqual([]);
    const com = sim.skateboard.centerOfMass();
    for (const b of sim.skateboard.bodies) {
      Matter.Body.setPosition(b, { x: 2 * com.x - b.position.x, y: 2 * com.y - b.position.y });
      Matter.Body.setAngle(b, b.angle + Math.PI);
    }
    for (let i = 0; i < 200 && causes.length === 0; i++) sim.step(idle);
    expect(causes).toContain('head');
    sim.dispose();
  });

  it('dies when falling below the level boundary, then restarts cleanly at spawn', () => {
    const causes: string[] = [];
    const level = builtInLevel({
      id: 'gap',
      name: 'gap',
      difficulty: '',
      strokes: [stroke('a', line(0, 500, 200, 500))],
      spawn: pt(60, spawnHeight(500)),
      flag: pt(5000, 500),
    });
    const sim = new Simulation(level, { onDeath: (c) => causes.push(c) });
    for (let i = 0; i < 600 && causes.length === 0; i++) sim.step(idle);
    expect(causes).toEqual(['void']);
    expect(sim.time).toBeLessThan(0.1);
    expect(sim.skateboard.board.position.x).toBeCloseTo(60, 0);
    expect(sim.jump.chargeSeconds).toBe(0);
    sim.dispose();
  });

  it('victory triggers exactly once and freezes the simulation', () => {
    let wins = 0;
    const level = { ...flat(), flag: pt(400, 500) };
    const sim = new Simulation(level, { onVictory: () => wins++ });
    run(sim, 400);
    expect(sim.status).toBe('won');
    const frozenTime = sim.time;
    const frozenX = sim.skateboard.board.position.x;
    run(sim, 60);
    expect(wins).toBe(1);
    expect(sim.time).toBe(frozenTime);
    expect(sim.skateboard.board.position.x).toBe(frozenX);
    sim.dispose();
  });

  it('survives a restart in the middle of a collision', () => {
    const sim = new Simulation(flat());
    run(sim, 100);
    sim.restart();
    expect(sim.time).toBe(0);
    run(sim, 100);
    expect(Number.isFinite(sim.skateboard.board.position.x)).toBe(true);
    expect(sim.skateboard.board.position.x).toBeGreaterThan(60);
    sim.dispose();
  });

  it('never exceeds the speed cap', () => {
    const level = builtInLevel({
      id: 'drop',
      name: 'drop',
      difficulty: '',
      strokes: [stroke('s', line(0, 0, 3000, 3000))],
      spawn: pt(60, -24),
      flag: pt(5000, 5000),
    });
    const sim = new Simulation(level);
    let max = 0;
    for (let i = 0; i < 400; i++) {
      sim.step(idle);
      max = Math.max(max, sim.speed);
    }
    expect(max).toBeLessThan(2200);
    sim.dispose();
  });
});

const PLANS: PlannedJump[][] = [
  [],
  [
    { at: 1030, charge: 0.25 },
    { at: 2080, charge: 0.25 },
  ],
  [
    { at: 1680, charge: 0.45 },
    { at: 3880, charge: 0.4 },
  ],
  [],
  [
    { at: 1790, charge: 0.4 },
    { at: 3290, charge: 0.5 },
    { at: 4890, charge: 0.7 },
  ],
];

describe('built-in levels are completable', () => {
  BUILT_IN_LEVELS.forEach((level, i) => {
    it(`${level.name} can be finished with the scripted autopilot`, () => {
      const result = runBot(level, PLANS[i] ?? [], 60);
      expect(result.won).toBe(true);
    }, 60_000);
  });
});
