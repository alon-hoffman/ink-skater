import { PHYSICS } from './physicsConfig';

export interface JumpUpdate {
  crouch: boolean;
  /** True when at least one wheel touches terrain. */
  grounded: boolean;
  dt: number;
}

export interface JumpEvent {
  /** 0..1 fraction of max charge held. */
  charge01: number;
  /** Launch speed in px/s. */
  speed: number;
}

/** Pure state machine for charging and releasing jumps. */
export class JumpController {
  private charge = 0;
  private charging = false;
  private cooldown = 0;

  get chargeSeconds(): number {
    return this.charge;
  }

  get charge01(): number {
    return Math.min(1, this.charge / PHYSICS.jump.maxChargeSeconds);
  }

  get isCharging(): boolean {
    return this.charging;
  }

  reset(): void {
    this.charge = 0;
    this.charging = false;
    this.cooldown = 0;
  }

  /** Advance one tick; returns a jump event exactly once per valid crouch release. */
  update({ crouch, grounded, dt }: JumpUpdate): JumpEvent | null {
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (!grounded) {
      // Airborne: charge is lost immediately and a midair release does nothing.
      this.charge = 0;
      this.charging = false;
      return null;
    }

    if (crouch) {
      if (this.cooldown <= 0) {
        this.charging = true;
        this.charge = Math.min(PHYSICS.jump.maxChargeSeconds, this.charge + dt);
      }
      return null;
    }

    if (this.charging) {
      const charge01 = this.charge01;
      this.charge = 0;
      this.charging = false;
      this.cooldown = PHYSICS.jump.cooldownSeconds;
      const eased = charge01 * (2 - charge01);
      return {
        charge01,
        speed: PHYSICS.jump.minSpeed + (PHYSICS.jump.maxSpeed - PHYSICS.jump.minSpeed) * eased,
      };
    }
    return null;
  }
}
