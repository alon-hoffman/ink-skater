import { describe, expect, it } from 'vitest';
import { TRICK, TrickTracker, flipPointsFor } from '../src/game/TrickTracker';
import type { TrickInput } from '../src/game/TrickTracker';

const DT = 1 / 60;
const UP = { x: 0, y: -1 };

function air(angle: number): TrickInput {
  return {
    angle,
    frontGrounded: false,
    rearGrounded: false,
    groundNormal: null,
    speed: 400,
    dt: DT,
  };
}
function ground(angle: number, front = true, rear = true, speed = 400): TrickInput {
  return { angle, frontGrounded: front, rearGrounded: rear, groundNormal: UP, speed, dt: DT };
}

/** Feed `ticks` airborne ticks that rotate by `totalAngle` in total, starting at `from`. */
function spinThrough(t: TrickTracker, from: number, totalAngle: number, ticks: number): void {
  for (let i = 1; i <= ticks; i++) t.update(air(from + (totalAngle * i) / ticks));
}

describe('flips', () => {
  it('a full spin that is landed scores 100 and reports a Flip', () => {
    const t = new TrickTracker();
    t.update(ground(0));
    spinThrough(t, 0, Math.PI * 2, 40);
    const events = t.update(ground(Math.PI * 2));
    expect(events).toEqual([{ kind: 'flip', points: 100, label: 'Flip' }]);
    expect(t.score).toBe(100);
  });

  it('counts a backwards spin too, and pays more for a double', () => {
    const t = new TrickTracker();
    t.update(ground(0));
    spinThrough(t, 0, -Math.PI * 4, 80);
    t.update(ground(0));
    expect(t.score).toBe(flipPointsFor(2));
    expect(flipPointsFor(2)).toBe(300);
  });

  it('a half spin or a wobble scores nothing', () => {
    const t = new TrickTracker();
    t.update(ground(0));
    spinThrough(t, 0, Math.PI, 30);
    t.update(ground(Math.PI));
    expect(t.score).toBe(0);
  });

  it('a spin that never lands earns nothing', () => {
    const t = new TrickTracker();
    t.update(ground(0));
    spinThrough(t, 0, Math.PI * 2, 40);
    expect(t.score).toBe(0);
  });

  it('spin does not count while a wheel is on the ground', () => {
    const t = new TrickTracker();
    for (let i = 0; i < 100; i++) t.update(ground((i * Math.PI * 2) / 50, true, false));
    expect(t.score).toBe(0);
  });

  it('reset clears the score', () => {
    const t = new TrickTracker();
    t.update(ground(0));
    spinThrough(t, 0, Math.PI * 2, 40);
    t.update(ground(0));
    t.reset();
    expect(t.score).toBe(0);
  });
});

describe('manuals', () => {
  const ride = (t: TrickTracker, seconds: number, angle = 0.3): void => {
    for (let i = 0; i < Math.round(seconds * 60); i++) t.update(ground(angle, false, true));
  };

  it('riding on one wheel for 1 second then landing both banks about 50 points', () => {
    const t = new TrickTracker();
    ride(t, 1);
    const events: ReturnType<TrickTracker['update']> = [];
    for (let i = 0; i < 10; i++) events.push(...t.update(ground(0)));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('manual');
    expect(t.score).toBeGreaterThanOrEqual(45);
    expect(t.score).toBeLessThanOrEqual(55);
  });

  it('under half a second scores nothing', () => {
    const t = new TrickTracker();
    ride(t, TRICK.manualMinSeconds - 0.15);
    for (let i = 0; i < 10; i++) t.update(ground(0));
    expect(t.score).toBe(0);
  });

  it('a brief wheel flicker does not end the manual', () => {
    const t = new TrickTracker();
    ride(t, 0.6);
    t.update(ground(0));
    ride(t, 0.6);
    for (let i = 0; i < 10; i++) t.update(ground(0));
    expect(t.score).toBeGreaterThan(50);
  });

  it('standing nearly still on one wheel is not a manual', () => {
    const t = new TrickTracker();
    for (let i = 0; i < 120; i++) t.update(ground(0.3, false, true, 5));
    for (let i = 0; i < 10; i++) t.update(ground(0));
    expect(t.score).toBe(0);
  });

  it('pending points are visible while riding and flush banks them on finish', () => {
    const t = new TrickTracker();
    ride(t, 1);
    expect(t.pendingManualPoints).toBeGreaterThan(40);
    expect(t.flush()).toHaveLength(1);
    expect(t.score).toBeGreaterThan(40);
  });

  it('a long jump off a manual banks it', () => {
    const t = new TrickTracker();
    ride(t, 1);
    for (let i = 0; i < Math.round((TRICK.manualAirGraceSeconds + 0.2) * 60); i++) t.update(air(0.3));
    expect(t.score).toBeGreaterThan(40);
  });

  it('a short hop between one-wheel stretches is one combined manual', () => {
    const t = new TrickTracker();
    ride(t, 1);
    for (let i = 0; i < 30; i++) t.update(air(0.3));
    expect(t.score).toBe(0);
    ride(t, 2);
    for (let i = 0; i < 10; i++) t.update(ground(0));
    expect(t.score).toBeGreaterThanOrEqual(145);
    expect(t.score).toBeLessThanOrEqual(155);
  });
});
