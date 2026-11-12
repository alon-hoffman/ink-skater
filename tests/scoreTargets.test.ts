import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/game/Simulation';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { runManualBot } from './trickBot';

const level = (id: string) => {
  const found = BUILT_IN_LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('score targets can be reached while still beating the time limit', () => {
  it('First Ride: a manual through the middle of the course meets both bonus objectives', () => {
    const l = level('builtin-1');
    const r = runManualBot(l, { from: 1.5, to: 6 });
    expect(r.won).toBe(true);
    expect(r.deaths).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(l.objectives!.scoreTarget);
    expect(r.time).toBeLessThanOrEqual(l.objectives!.timeLimit);
  });

  it('Launch Pad: a charged hop off the first kicker with a spin lands a flip without crashing', () => {
    const l = level('builtin-20');
    const lipAt = 2810;
    const sim = new Simulation(l, {});
    let airTicks = 0;
    for (let i = 0; i < 60 * 25 && sim.status === 'running' && sim.deaths === 0; i++) {
      const x = sim.skateboard.board.position.x;
      let tilt: -1 | 0 | 1;
      let crouch = false;
      if (sim.grounded) {
        airTicks = 0;
        const n = sim.contacts.groundNormal;
        const ground = n ? Math.atan2(n.x, -n.y) : 0;
        const err = sim.skateboard.board.angle - ground;
        tilt = err > 0.12 ? -1 : err < -0.12 ? 1 : 0;
        if (x > lipAt - sim.speed * 0.1 && x < lipAt) crouch = true;
      } else {
        airTicks++;
        const a = sim.skateboard.board.angle;
        if (x > lipAt && airTicks < 75) tilt = 1;
        else tilt = Math.abs(a) < 1.6 ? (a > 0.15 ? -1 : a < -0.15 ? 1 : 0) : 0;
      }
      sim.step({ tilt, crouch, flip: false });
    }
    const score = sim.score;
    const deaths = sim.deaths;
    sim.dispose();
    expect(deaths).toBe(0);
    expect(score).toBeGreaterThanOrEqual(100);
  }, 60_000);
});
