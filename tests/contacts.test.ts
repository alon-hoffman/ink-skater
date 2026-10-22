import { describe, expect, it } from 'vitest';
import { ContactTracker } from '../src/game/ContactTracker';
import { PHYSICS } from '../src/game/physicsConfig';

const n = { x: 0, y: -1 };
const p = { x: 0, y: 0 };

describe('ContactTracker', () => {
  it('starts airborne and becomes grounded per wheel', () => {
    const c = new ContactTracker();
    expect(c.airborne).toBe(true);
    c.report('front', n, p);
    c.endTick();
    expect(c.wheel('front').grounded).toBe(true);
    expect(c.wheel('rear').grounded).toBe(false);
    expect(c.anyGrounded).toBe(true);
    expect(c.groundNormal).toEqual(n);
  });

  it('bridges a single missed tick but not a real takeoff', () => {
    const c = new ContactTracker();
    c.report('rear', n, p);
    c.endTick();
    for (let i = 0; i < PHYSICS.contactGraceTicks; i++) {
      c.endTick();
      expect(c.wheel('rear').grounded).toBe(true);
    }
    c.endTick();
    expect(c.wheel('rear').grounded).toBe(false);
    expect(c.airborne).toBe(true);
    expect(c.groundNormal).toBeNull();
  });

  it('averages normals of both grounded wheels', () => {
    const c = new ContactTracker();
    c.report('front', { x: -1, y: 0 }, p);
    c.report('rear', { x: 0, y: -1 }, p);
    c.endTick();
    const g = c.groundNormal;
    expect(g?.x).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(g?.y).toBeCloseTo(-Math.SQRT1_2, 5);
  });
});
