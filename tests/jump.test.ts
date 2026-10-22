import { describe, expect, it } from 'vitest';
import { JumpController } from '../src/game/JumpController';
import { PHYSICS } from '../src/game/physicsConfig';

const dt = PHYSICS.stepSeconds;

function hold(jc: JumpController, ticks: number, grounded = true): void {
  for (let i = 0; i < ticks; i++) jc.update({ crouch: true, grounded, dt });
}

describe('JumpController', () => {
  it('charges while crouching on the ground and jumps once on release', () => {
    const jc = new JumpController();
    hold(jc, 20);
    expect(jc.isCharging).toBe(true);
    const jump = jc.update({ crouch: false, grounded: true, dt });
    expect(jump).not.toBeNull();
    expect(jump?.speed).toBeGreaterThan(PHYSICS.jump.minSpeed);
    expect(jc.update({ crouch: false, grounded: true, dt })).toBeNull();
    expect(jc.update({ crouch: false, grounded: true, dt })).toBeNull();
  });

  it('longer charge launches harder, capped at the maximum', () => {
    const a = new JumpController();
    hold(a, 5);
    const short = a.update({ crouch: false, grounded: true, dt });
    const b = new JumpController();
    hold(b, 200);
    const long = b.update({ crouch: false, grounded: true, dt });
    expect(long?.speed ?? 0).toBeGreaterThan(short?.speed ?? 0);
    expect(long?.speed).toBeCloseTo(PHYSICS.jump.maxSpeed, 5);
    expect(long?.charge01).toBe(1);
  });

  it('resets the charge as soon as both wheels leave the ground', () => {
    const jc = new JumpController();
    hold(jc, 30);
    jc.update({ crouch: true, grounded: false, dt });
    expect(jc.chargeSeconds).toBe(0);
    expect(jc.isCharging).toBe(false);
  });

  it('releasing in midair does not jump', () => {
    const jc = new JumpController();
    hold(jc, 30);
    jc.update({ crouch: true, grounded: false, dt });
    expect(jc.update({ crouch: false, grounded: false, dt })).toBeNull();
    expect(jc.update({ crouch: false, grounded: true, dt })).toBeNull();
  });

  it('does not accumulate charge in the air, but starts charging on landing while still held', () => {
    const jc = new JumpController();
    hold(jc, 30, false);
    expect(jc.chargeSeconds).toBe(0);
    hold(jc, 10, true);
    expect(jc.isCharging).toBe(true);
    expect(jc.chargeSeconds).toBeCloseTo(10 * dt, 5);
    expect(jc.update({ crouch: false, grounded: true, dt })).not.toBeNull();
  });

  it('works when only one wheel is down (grounded means any wheel)', () => {
    const jc = new JumpController();
    hold(jc, 10, true);
    expect(jc.update({ crouch: false, grounded: true, dt })).not.toBeNull();
  });
});
