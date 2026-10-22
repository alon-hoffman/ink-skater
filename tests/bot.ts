import type { InputSample } from '../src/game/InputState';
import { Simulation } from '../src/game/Simulation';
import type { Level } from '../src/levels/levelTypes';

export interface PlannedJump {
  /** Release the crouch when board x passes this value (in travel direction). */
  at: number;
  /** Seconds to hold crouch before release. */
  charge: number;
  /** Optional tilt during the flight: -1/1, with tick range relative to takeoff. */
  airTilt?: { dir: -1 | 1; from: number; to: number };
  /** Hold off the stabiliser during this flight (for flips). */
  noStabilize?: boolean;
}

export interface BotResult {
  won: boolean;
  time: number;
  deaths: number;
  ticks: number;
  deathPoints: string[];
}

/** Scripted autopilot: planned jumps plus a simple upright-seeking air/ground stabiliser. */
export function runBot(
  level: Level,
  jumps: PlannedJump[],
  maxSeconds = 90,
  log?: (s: string) => void,
  opts: { wallLean?: boolean; stopAtX?: number } = {},
): BotResult {
  const deathPoints: string[] = [];
  const sim = new Simulation(level, {
    onDeath: (cause) => {
      const b = sim.skateboard.board;
      deathPoints.push(
        `${cause}@${Math.round(b.position.x)},${Math.round(b.position.y)} t=${sim.time.toFixed(1)}`,
      );
    },
  });
  const dir = level.spawnDirection;
  let jumpIndex = 0;
  let airTicks = 0;
  let activeJump: PlannedJump | null = null;
  let lastDeaths = 0;
  const maxTicks = maxSeconds * 60;
  let total = 0;
  let reached = false;
  while (sim.status === 'running' && total < maxTicks) {
    if (
      opts.stopAtX !== undefined &&
      sim.skateboard.board.position.x * dir > opts.stopAtX &&
      sim.deaths === 0 &&
      sim.grounded
    ) {
      reached = true;
      break;
    }
    if (sim.deaths !== lastDeaths) {
      lastDeaths = sim.deaths;
      jumpIndex = 0;
      activeJump = null;
    }
    const b = sim.skateboard.board;
    const progress = b.position.x * dir;
    const next = jumps[jumpIndex];
    let crouch = false;
    let tilt: -1 | 0 | 1 = 0;
    if (next) {
      const startHold = next.at * dir - sim.speed * next.charge * 1.0;
      if (sim.grounded && progress >= startHold && progress < next.at * dir) crouch = true;
      if (progress >= next.at * dir) {
        if (sim.jump.isCharging === false && !sim.grounded) {
          /* already airborne past the mark */
        }
        activeJump = next;
        jumpIndex++;
        airTicks = 0;
      }
    }
    if (!sim.grounded) {
      airTicks++;
      const aj = activeJump;
      if (aj?.airTilt && airTicks >= aj.airTilt.from && airTicks <= aj.airTilt.to)
        tilt = aj.airTilt.dir;
      else if (!aj?.noStabilize) {
        const a = b.angle;
        if (Math.abs(a) < 1.6) {
          if (a > 0.15) tilt = -1;
          else if (a < -0.15) tilt = 1;
        }
      }
    }
    if (sim.grounded && opts.wallLean && b.angle < -0.3 && b.angle > -3.4) tilt = -1;
    const input: InputSample = { tilt, crouch, flip: false };
    sim.step(input);
    total++;
    if (log && total % 6 === 0) {
      log(
        `${total} x=${b.position.x.toFixed(0)} y=${b.position.y.toFixed(0)} a=${b.angle.toFixed(2)} v=${sim.speed.toFixed(0)} g=${sim.grounded} c=${crouch}`,
      );
    }
  }
  const result = {
    won: sim.status === 'won' || reached,
    time: sim.time,
    deaths: sim.deaths,
    ticks: total,
    deathPoints,
  };
  sim.dispose();
  return result;
}

export interface ScriptStep {
  /** Advance to the next step once this returns true (checked before each tick). */
  until: (sim: Simulation) => boolean;
  /** Turn around on the first tick of this step. */
  flip?: boolean;
  /** Hold crouch (charge a jump) while this step is active. */
  crouch?: boolean;
}

/** Scripted autopilot for levels that need turns: a list of steps plus the same air stabiliser as `runBot`. */
export function runScript(level: Level, steps: ScriptStep[], maxSeconds = 60): BotResult {
  const deathPoints: string[] = [];
  const sim = new Simulation(level, {
    onDeath: (cause) => {
      const b = sim.skateboard.board;
      deathPoints.push(`${cause}@${Math.round(b.position.x)},${Math.round(b.position.y)}`);
    },
  });
  let index = 0;
  let fresh = true;
  let lastDeaths = 0;
  let total = 0;
  while (sim.status === 'running' && total < maxSeconds * 60) {
    if (sim.deaths !== lastDeaths) {
      lastDeaths = sim.deaths;
      index = 0;
      fresh = true;
    }
    let step = steps[index];
    while (step && step.until(sim)) {
      index++;
      fresh = true;
      step = steps[index];
    }
    const b = sim.skateboard.board;
    let tilt: -1 | 0 | 1 = 0;
    if (!sim.grounded && Math.abs(b.angle) < 1.6) {
      if (b.angle > 0.15) tilt = -1;
      else if (b.angle < -0.15) tilt = 1;
    }
    sim.step({ tilt, crouch: !!step?.crouch, flip: fresh && !!step?.flip });
    fresh = false;
    total++;
  }
  const result = {
    won: sim.status === 'won',
    time: sim.time,
    deaths: sim.deaths,
    ticks: total,
    deathPoints,
  };
  sim.dispose();
  return result;
}
