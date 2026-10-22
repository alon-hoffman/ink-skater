import type { Vec2 } from '../levels/levelTypes';
import { PHYSICS } from './physicsConfig';

export type WheelId = 'front' | 'rear';

export interface WheelContact {
  grounded: boolean;
  /** Unit normal pointing from terrain toward the wheel (last known while grounded). */
  normal: Vec2;
  point: Vec2;
}

interface WheelState extends WheelContact {
  graceLeft: number;
}

const up = (): Vec2 => ({ x: 0, y: -1 });

/**
 * Per-wheel grounded state fed by real physics contacts.
 * A short grace period bridges single-tick gaps so the state does not flicker.
 */
export class ContactTracker {
  private readonly wheels: Record<WheelId, WheelState> = {
    front: { grounded: false, normal: up(), point: { x: 0, y: 0 }, graceLeft: 0 },
    rear: { grounded: false, normal: up(), point: { x: 0, y: 0 }, graceLeft: 0 },
  };
  private pending: Partial<Record<WheelId, { normal: Vec2; point: Vec2 }>> = {};

  /** Called for every wheel/terrain contact seen by the physics engine during a tick. */
  report(wheel: WheelId, normal: Vec2, point: Vec2): void {
    this.pending[wheel] = { normal, point };
  }

  /** Close the tick: commit reported contacts, count down grace periods. */
  endTick(): void {
    for (const id of ['front', 'rear'] as const) {
      const state = this.wheels[id];
      const hit = this.pending[id];
      if (hit) {
        state.grounded = true;
        state.normal = hit.normal;
        state.point = hit.point;
        state.graceLeft = PHYSICS.contactGraceTicks;
      } else if (state.graceLeft > 0) {
        state.graceLeft--;
      } else {
        state.grounded = false;
      }
    }
    this.pending = {};
  }

  reset(): void {
    for (const id of ['front', 'rear'] as const) {
      const s = this.wheels[id];
      s.grounded = false;
      s.graceLeft = 0;
    }
    this.pending = {};
  }

  wheel(id: WheelId): WheelContact {
    return this.wheels[id];
  }

  get anyGrounded(): boolean {
    return this.wheels.front.grounded || this.wheels.rear.grounded;
  }

  get airborne(): boolean {
    return !this.anyGrounded;
  }

  /** Average normal of grounded wheels, or null when airborne. */
  get groundNormal(): Vec2 | null {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const id of ['front', 'rear'] as const) {
      const w = this.wheels[id];
      if (w.grounded) {
        x += w.normal.x;
        y += w.normal.y;
        n++;
      }
    }
    if (n === 0) return null;
    const len = Math.hypot(x, y);
    return len < 1e-6 ? up() : { x: x / len, y: y / len };
  }
}
