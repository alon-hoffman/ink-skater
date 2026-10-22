import { describe, expect, it } from 'vitest';
import { InputState } from '../src/game/InputState';
import { JumpController } from '../src/game/JumpController';

const dt = 1 / 60;

describe('InputState', () => {
  it('maps single keys to tilt', () => {
    const s = new InputState();
    s.keyDown('ArrowLeft');
    expect(s.sample()).toEqual({ tilt: -1, crouch: false });
    s.keyUp('ArrowLeft');
    s.keyDown('KeyD');
    expect(s.sample()).toEqual({ tilt: 1, crouch: false });
  });

  it('holding both directions crouches and cancels tilt', () => {
    const s = new InputState();
    s.keyDown('ArrowLeft');
    s.keyDown('ArrowRight');
    expect(s.sample()).toEqual({ tilt: 0, crouch: true });
  });

  it('releasing one side ends the crouch and the remaining side tilts immediately', () => {
    const s = new InputState();
    s.keyDown('ArrowLeft');
    s.keyDown('ArrowRight');
    s.keyUp('ArrowLeft');
    expect(s.sample()).toEqual({ tilt: 1, crouch: false });
  });

  it('space takes precedence over the arrow pair without a duplicate jump', () => {
    const s = new InputState();
    const jc = new JumpController();
    const tick = () => jc.update({ ...s.sample(), grounded: true, dt });
    s.keyDown('Space');
    for (let i = 0; i < 10; i++) tick();
    s.keyDown('ArrowLeft');
    s.keyDown('ArrowRight');
    expect(tick()).toBeNull();
    s.keyUp('ArrowLeft');
    expect(s.sample().crouch).toBe(true);
    expect(tick()).toBeNull();
    s.keyUp('ArrowRight');
    expect(tick()).toBeNull();
    s.keyUp('Space');
    expect(tick()).not.toBeNull();
    expect(tick()).toBeNull();
  });

  it('tracks touch pointers independently by id', () => {
    const s = new InputState();
    s.pointerDown(1, 'left');
    s.pointerDown(2, 'right');
    expect(s.sample().crouch).toBe(true);
    s.pointerUp(1);
    expect(s.sample()).toEqual({ tilt: 1, crouch: false });
    s.pointerUp(2);
    expect(s.sample()).toEqual({ tilt: 0, crouch: false });
  });

  it('two fingers then one release gives exactly one jump and keeps the other finger tilting', () => {
    const s = new InputState();
    const jc = new JumpController();
    s.pointerDown(1, 'left');
    s.pointerDown(2, 'right');
    for (let i = 0; i < 15; i++) jc.update({ ...s.sample(), grounded: true, dt });
    s.pointerUp(1);
    const sample = s.sample();
    expect(sample.tilt).toBe(1);
    expect(jc.update({ ...sample, grounded: true, dt })).not.toBeNull();
    expect(jc.update({ ...s.sample(), grounded: true, dt })).toBeNull();
  });

  it('reset clears every stuck input (focus loss, cancelled gestures)', () => {
    const s = new InputState();
    s.keyDown('ArrowLeft');
    s.keyDown('Space');
    s.pointerDown(5, 'right');
    s.reset();
    expect(s.sample()).toEqual({ tilt: 0, crouch: false });
  });
});
