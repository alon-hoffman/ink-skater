/**
 * Trick scoring. Pure logic: it is fed the board state once per physics tick and reports points.
 *
 * - Flip: a full spin (about 360 degrees, either direction) while no wheel touches the ground.
 *   It scores when you land. Extra spins in the same jump are worth more each.
 * - Manual: riding on exactly one wheel for at least `manualMinSeconds`. It scores when the manual ends.
 *   A short hop (up to `manualAirGraceSeconds`) between one-wheel stretches keeps it going as one manual.
 */

export const TRICK = {
  /** Points for one flip. Spin counts: 1 -> 100, 2 -> 300, 3 -> 600 (n * (n + 1) / 2 * flipPoints). */
  flipPoints: 50,
  /** A spin this close to a whole turn counts (0.8 of a turn is a flip). */
  flipTurnSlack: 0.2,
  manualPointsPerSecond: 80,
  manualMinSeconds: 0.5,
  /** Slowest speed (px/s) at which a one-wheel ride still counts as a manual. */
  manualMinSpeed: 60,
  /** Largest board tilt (radians) from the ground surface for a manual. */
  manualMaxTilt: 0.95,
  /** Ticks a manual may be interrupted (wheel flicker) without ending. */
  manualGapTicks: 6,
  /** Seconds airborne a manual survives; landing on one wheel again within it continues the manual. */
  manualAirGraceSeconds: 1.5,
} as const;

export type TrickKind = 'flip' | 'manual';

export interface TrickEvent {
  kind: TrickKind;
  points: number;
  /** Short label for the on-screen pop-up, e.g. "Double Flip". */
  label: string;
}

export interface TrickInput {
  /** Board angle in radians (any range; it may be unwrapped). */
  angle: number;
  frontGrounded: boolean;
  rearGrounded: boolean;
  /** Ground normal (pointing away from the surface) or null when airborne. */
  groundNormal: { x: number; y: number } | null;
  /** Board speed in px/s. */
  speed: number;
  dt: number;
}

const TAU = Math.PI * 2;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function flipPointsFor(spins: number): number {
  return TRICK.flipPoints * ((spins * (spins + 1)) / 2);
}

export function flipLabel(spins: number): string {
  if (spins === 1) return 'Flip';
  if (spins === 2) return 'Double Flip';
  if (spins === 3) return 'Triple Flip';
  return `${spins}x Flip`;
}

export class TrickTracker {
  /** Points banked in the current run. */
  score = 0;
  /** Seconds of the manual being ridden right now (0 when none). */
  manualSeconds = 0;

  private wasAirborne = true;
  private spin = 0;
  private lastAngle = 0;
  private haveAngle = false;
  private manualGap = 0;
  private manualAir = 0;

  reset(): void {
    this.manualAir = 0;
    this.score = 0;
    this.manualSeconds = 0;
    this.wasAirborne = true;
    this.spin = 0;
    this.haveAngle = false;
    this.manualGap = 0;
  }

  /** Points the current manual would bank if it ended cleanly now (0 until it qualifies). */
  get pendingManualPoints(): number {
    return this.manualSeconds >= TRICK.manualMinSeconds ? manualPointsFor(this.manualSeconds) : 0;
  }

  update(input: TrickInput): TrickEvent[] {
    const events: TrickEvent[] = [];
    const airborne = !input.frontGrounded && !input.rearGrounded;

    // Spin tracking: accumulate rotation only while fully airborne.
    if (this.haveAngle && airborne) this.spin += wrap(input.angle - this.lastAngle);
    this.lastAngle = input.angle;
    this.haveAngle = true;

    if (airborne) {
      if (!this.wasAirborne) this.spin = 0;
    } else if (this.wasAirborne) {
      const spins = Math.floor(Math.abs(this.spin) / TAU + TRICK.flipTurnSlack);
      if (spins >= 1) {
        const points = flipPointsFor(spins);
        this.score += points;
        events.push({ kind: 'flip', points, label: flipLabel(spins) });
      }
      this.spin = 0;
    }
    this.wasAirborne = airborne;

    this.updateManual(input, airborne, events);
    return events;
  }

  /** Bank a manual that is still going (used when the level is finished mid-manual). */
  flush(): TrickEvent[] {
    const events: TrickEvent[] = [];
    if (this.manualSeconds > 0) this.endManual(events);
    return events;
  }

  private updateManual(input: TrickInput, airborne: boolean, events: TrickEvent[]): void {
    const oneWheel = input.frontGrounded !== input.rearGrounded;
    const n = input.groundNormal;
    let valid = false;
    if (oneWheel && n && input.speed >= TRICK.manualMinSpeed && n.y < -0.3) {
      const groundAngle = Math.atan2(n.x, -n.y);
      valid = Math.abs(wrap(input.angle - groundAngle)) <= TRICK.manualMaxTilt;
    }
    if (valid) {
      this.manualSeconds += input.dt;
      this.manualGap = 0;
      this.manualAir = 0;
      return;
    }
    if (this.manualSeconds === 0) return;
    if (airborne) {
      // Hopping off a lip keeps the manual alive: land on one wheel again within the grace time and
      // it carries on (air time itself isn't counted). Stay up too long and it banks.
      this.manualAir += input.dt;
      if (this.manualAir > TRICK.manualAirGraceSeconds) this.endManual(events);
      return;
    }
    // Both wheels down (or a wheel flicker): only a short grace before the manual is over.
    this.manualGap++;
    if (this.manualGap > TRICK.manualGapTicks) this.endManual(events);
  }

  private endManual(events: TrickEvent[]): void {
    if (this.manualSeconds >= TRICK.manualMinSeconds) {
      const points = manualPointsFor(this.manualSeconds);
      this.score += points;
      events.push({ kind: 'manual', points, label: 'Manual' });
    }
    this.manualSeconds = 0;
    this.manualGap = 0;
    this.manualAir = 0;
  }
}

export function manualPointsFor(seconds: number): number {
  return Math.round((seconds * TRICK.manualPointsPerSecond) / 5) * 5;
}
