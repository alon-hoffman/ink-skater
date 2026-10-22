import Matter from 'matter-js';
import type { Vec2 } from '../levels/levelTypes';
import { PHYSICS } from './physicsConfig';

const { Bodies, Body, Constraint, Composite } = Matter;

export const BOARD_LABEL = 'board';
export const WHEEL_FRONT_LABEL = 'wheelFront';
export const WHEEL_REAR_LABEL = 'wheelRear';
const BOARD_CATEGORY = 0x0002;

export interface Transform {
  x: number;
  y: number;
  angle: number;
}

/**
 * The physical skateboard: one deck body and two circular wheel bodies pinned to it
 * with stiff constraints. All three share a negative collision group so they never
 * collide with each other, but each collides with terrain independently.
 */
export class Skateboard {
  readonly board: Matter.Body;
  readonly wheelFront: Matter.Body;
  readonly wheelRear: Matter.Body;
  private readonly constraints: Matter.Constraint[];

  constructor(private readonly world: Matter.World) {
    const group = Body.nextGroup(true);
    const filter = { group, category: BOARD_CATEGORY, mask: 0xffff };
    const { board: b, wheel: w } = PHYSICS;

    this.board = Bodies.rectangle(0, 0, b.length, b.thickness, {
      label: BOARD_LABEL,
      friction: b.friction,
      restitution: 0,
      frictionAir: 0,
      collisionFilter: filter,
    });
    Body.setMass(this.board, b.mass);
    Body.setInertia(this.board, b.inertia);

    const makeWheel = (label: string, offsetX: number): Matter.Body => {
      const wheel = Bodies.polygon(offsetX, w.offsetY, 60, w.radius, {
        label,
        friction: w.friction,
        frictionStatic: w.frictionStatic,
        restitution: w.restitution,
        frictionAir: 0,
        collisionFilter: filter,
      });
      Body.setMass(wheel, w.mass);
      return wheel;
    };
    this.wheelFront = makeWheel(WHEEL_FRONT_LABEL, w.offsetX);
    this.wheelRear = makeWheel(WHEEL_REAR_LABEL, -w.offsetX);

    const pin = (wheel: Matter.Body, offsetX: number): Matter.Constraint =>
      Constraint.create({
        bodyA: this.board,
        pointA: { x: offsetX, y: w.offsetY },
        bodyB: wheel,
        pointB: { x: 0, y: 0 },
        length: 0,
        stiffness: 1,
        damping: 0,
      });
    this.constraints = [pin(this.wheelFront, w.offsetX), pin(this.wheelRear, -w.offsetX)];

    Composite.add(world, [this.board, this.wheelFront, this.wheelRear, ...this.constraints]);
  }

  get bodies(): Matter.Body[] {
    return [this.board, this.wheelFront, this.wheelRear];
  }

  /** Place the assembly at rest with the board centre at `spawn`. */
  reset(spawn: Vec2): void {
    const w = PHYSICS.wheel;
    const place = (body: Matter.Body, x: number, y: number): void => {
      Body.setAngle(body, 0);
      Body.setPosition(body, { x, y });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      body.force.x = 0;
      body.force.y = 0;
      body.torque = 0;
    };
    place(this.board, spawn.x, spawn.y);
    place(this.wheelFront, spawn.x + w.offsetX, spawn.y + w.offsetY);
    place(this.wheelRear, spawn.x - w.offsetX, spawn.y + w.offsetY);
  }

  centerOfMass(): Vec2 {
    let m = 0;
    let x = 0;
    let y = 0;
    for (const body of this.bodies) {
      m += body.mass;
      x += body.position.x * body.mass;
      y += body.position.y * body.mass;
    }
    return { x: x / m, y: y / m };
  }

  /** Mass-weighted velocity in px per tick. */
  velocity(): Vec2 {
    let m = 0;
    let x = 0;
    let y = 0;
    for (const body of this.bodies) {
      const v = Body.getVelocity(body);
      m += body.mass;
      x += v.x * body.mass;
      y += v.y * body.mass;
    }
    return { x: x / m, y: y / m };
  }

  /** Add a velocity change (px/tick) to the whole assembly. */
  addVelocity(dv: Vec2): void {
    for (const body of this.bodies) {
      const v = Body.getVelocity(body);
      Body.setVelocity(body, { x: v.x + dv.x, y: v.y + dv.y });
    }
  }

  scaleVelocity(factor: number): void {
    for (const body of this.bodies) {
      const v = Body.getVelocity(body);
      Body.setVelocity(body, { x: v.x * factor, y: v.y * factor });
    }
  }

  /**
   * Spin the whole assembly as a rigid body about `pivot` (default: centre of mass), rad/tick change.
   * Keeps wheels coherent with the deck so angular momentum behaves physically.
   */
  addAngularVelocity(dOmega: number, pivot?: Vec2): void {
    const com = pivot ?? this.centerOfMass();
    for (const body of this.bodies) {
      const rx = body.position.x - com.x;
      const ry = body.position.y - com.y;
      const v = Body.getVelocity(body);
      Body.setVelocity(body, { x: v.x - dOmega * ry, y: v.y + dOmega * rx });
    }
    Body.setAngularVelocity(this.board, Body.getAngularVelocity(this.board) + dOmega);
  }

  angularVelocity(): number {
    return Body.getAngularVelocity(this.board);
  }

  /** Remove any spin beyond the cap by scaling it back (rad/tick). */
  clampAngular(maxOmega: number): void {
    const w = this.angularVelocity();
    if (Math.abs(w) > maxOmega) this.addAngularVelocity(Math.sign(w) * maxOmega - w);
  }

  isFinite(): boolean {
    return this.bodies.every(
      (b) =>
        Number.isFinite(b.position.x) &&
        Number.isFinite(b.position.y) &&
        Number.isFinite(b.angle) &&
        Math.abs(b.position.x) < 1e6 &&
        Math.abs(b.position.y) < 1e6,
    );
  }

  transforms(): { board: Transform; front: Transform; rear: Transform } {
    const t = (b: Matter.Body): Transform => ({ x: b.position.x, y: b.position.y, angle: b.angle });
    return { board: t(this.board), front: t(this.wheelFront), rear: t(this.wheelRear) };
  }

  dispose(): void {
    Composite.remove(this.world, [
      this.board,
      this.wheelFront,
      this.wheelRear,
      ...this.constraints,
    ]);
  }
}
