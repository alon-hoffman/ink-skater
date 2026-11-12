import { Simulation } from '../src/game/Simulation';
import type { Level } from '../src/levels/levelTypes';
import { groundTilt } from './bot';

export interface TrickBotResult {
  won: boolean;
  time: number;
  score: number;
  deaths: number;
}

/**
 * Plays a level on plain rolling ground, but rides a manual (front wheel up) between `from` and `to`
 * seconds, then levels out again. Used to show that a level's score target can be reached by riding tricks
 * while still finishing in time.
 */
export function runManualBot(
  level: Level,
  opts: { from: number; to: number; lift?: number; maxSeconds?: number },
): TrickBotResult {
  const { from, to, lift = 0.3, maxSeconds = 40 } = opts;
  const sim = new Simulation(level, {});
  let ticks = 0;
  while (sim.status === 'running' && ticks < maxSeconds * 60) {
    const t = sim.time;
    let tilt: -1 | 0 | 1;
    if (sim.grounded) {
      if (t >= from && t < to) {
        const n = sim.contacts.groundNormal;
        const ground = n ? Math.atan2(n.x, -n.y) : 0;
        const err = sim.skateboard.board.angle - (ground - lift);
        tilt = err > 0.08 ? -1 : err < -0.08 ? 1 : 0;
      } else {
        tilt = groundTilt(sim);
      }
    } else {
      const a = sim.skateboard.board.angle;
      tilt = Math.abs(a) < 1.6 ? (a > 0.15 ? -1 : a < -0.15 ? 1 : 0) : 0;
    }
    sim.step({ tilt, crouch: false, flip: false });
    ticks++;
  }
  const result = {
    won: sim.status === 'won',
    time: sim.time,
    score: sim.score,
    deaths: sim.deaths,
  };
  sim.dispose();
  return result;
}
