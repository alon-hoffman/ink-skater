import { describe, expect, it } from 'vitest';
import type { InputSample } from '../src/game/InputState';
import { Simulation } from '../src/game/Simulation';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';

interface Outcome {
  won: boolean;
  deaths: number;
  deathPoints: string[];
}

type Tilt = -1 | 0 | 1;

/**
 * Plays a level from the spawn without ever pressing crouch. In the air, a PD controller steers the board
 * towards `target` radians (positive = nose down), but only after `delay` airborne ticks of each flight.
 * `tilts: false` is the "does nothing" run.
 */
function play(
  id: string,
  opts: { tilts: boolean; target?: number; delay?: number; maxSeconds?: number },
): Outcome {
  const level = BUILT_IN_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`missing ${id}`);
  const { tilts, target = 0.3, delay = 0, maxSeconds = 25 } = opts;
  const deathPoints: string[] = [];
  const sim = new Simulation(level, {
    onDeath: (cause) => {
      const b = sim.skateboard.board;
      deathPoints.push(`${cause}@${Math.round(b.position.x)},${Math.round(b.position.y)}`);
    },
  });
  let air = 0;
  let ticks = 0;
  // Stop at the first death: the test cares about a clean run.
  while (sim.status === 'running' && deathPoints.length === 0 && ticks < maxSeconds * 60) {
    air = sim.grounded ? 0 : air + 1;
    let tilt: Tilt = 0;
    if (tilts && !sim.grounded && air > delay) {
      const b = sim.skateboard.board;
      const err = target - b.angle - 0.25 * b.angularVelocity * 60;
      if (err > 0.1) tilt = 1;
      else if (err < -0.1) tilt = -1;
    }
    const input: InputSample = { tilt, crouch: false, flip: false };
    sim.step(input);
    ticks++;
  }
  const outcome = { won: sim.status === 'won', deaths: deathPoints.length, deathPoints };
  sim.dispose();
  return outcome;
}

describe.each([
  ['builtin-14', 'Nose Dive'],
  ['builtin-15', 'Double Dive'],
])('%s %s', (id, name) => {
  it('is registered', () => {
    expect(BUILT_IN_LEVELS.find((l) => l.id === id)?.name).toBe(name);
  });

  it('is won by trimming the nose in flight, across a range of timings and attitudes', () => {
    for (const delay of [0, 12, 25]) {
      for (const target of [0, 0.3, 0.6]) {
        const result = play(id, { tilts: true, target, delay });
        expect(result, `delay ${delay} target ${target}`).toMatchObject({ won: true, deaths: 0 });
      }
    }
  });

  it('is not won by doing nothing: the lip spin tumbles you into the slope', () => {
    const result = play(id, { tilts: false });
    expect(result.won).toBe(false);
    expect(result.deaths).toBeGreaterThan(0);
  });
});
