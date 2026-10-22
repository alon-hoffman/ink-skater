import Matter from 'matter-js';
import type { Level, Vec2 } from '../levels/levelTypes';
import { ContactTracker } from './ContactTracker';
import type { WheelId } from './ContactTracker';
import type { InputSample } from './InputState';
import { JumpController } from './JumpController';
import { PoseAnimator, computePose } from './Pose';
import type { Pose } from './Pose';
import { PHYSICS } from './physicsConfig';
import { Skateboard, WHEEL_FRONT_LABEL, WHEEL_REAR_LABEL } from './Skateboard';
import type { Transform } from './Skateboard';
import { TERRAIN_LABEL, Terrain, computeDeathY } from './Terrain';

const { Engine, Events, Body, Bodies, Query } = Matter;

export type SimStatus = 'running' | 'won';
export type DeathCause = 'head' | 'void' | 'invalid';

export interface SimHooks {
  onJump?: (charge01: number) => void;
  onLand?: (impact01: number) => void;
  onDeath?: (cause: DeathCause) => void;
  onVictory?: (time: number) => void;
}

export interface RenderTransforms {
  board: Transform;
  front: Transform;
  rear: Transform;
}

const DT = PHYSICS.stepSeconds;
const FLAG_SENSOR = { width: 46, height: 110 };

/**
 * Authoritative gameplay simulation. Knows nothing about the DOM, React or Canvas,
 * so it runs unchanged in tests. Advance with `step()` at a fixed 60 Hz.
 */
export class Simulation {
  readonly engine: Matter.Engine;
  readonly terrain: Terrain;
  readonly skateboard: Skateboard;
  readonly contacts = new ContactTracker();
  readonly jump = new JumpController();
  readonly pose = new PoseAnimator();
  readonly deathY: number;

  status: SimStatus = 'running';
  time = 0;
  deaths = 0;
  ticks = 0;
  lastInput: InputSample = { tilt: 0, crouch: false };

  private readonly headSensor: Matter.Body;
  private readonly flagSensor: Matter.Body;
  private immunityTicks = 0;
  private prevRender: RenderTransforms;
  private currRender: RenderTransforms;
  private wasAirborne = true;
  private victoryFired = false;
  private readonly onContact: (event: Matter.IEventCollision<Matter.Engine>) => void;

  constructor(
    readonly level: Level,
    private readonly hooks: SimHooks = {},
  ) {
    this.engine = Engine.create({
      positionIterations: 10,
      velocityIterations: 8,
      constraintIterations: 4,
      enableSleeping: false,
    });
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = PHYSICS.gravity / 1e6;

    this.terrain = new Terrain(this.engine.world, level.strokes);
    this.skateboard = new Skateboard(this.engine.world);
    this.deathY = computeDeathY(level);

    this.headSensor = Bodies.circle(0, 0, PHYSICS.head.radius, { isSensor: true, isStatic: true });
    this.flagSensor = Bodies.rectangle(
      level.flag.x,
      level.flag.y - FLAG_SENSOR.height / 2,
      FLAG_SENSOR.width,
      FLAG_SENSOR.height,
      { isSensor: true, isStatic: true },
    );

    this.onContact = (event) => {
      for (const pair of event.pairs) this.recordPair(pair);
    };
    Events.on(this.engine, 'collisionStart', this.onContact);
    Events.on(this.engine, 'collisionActive', this.onContact);

    this.currRender = this.skateboard.transforms();
    this.prevRender = this.currRender;
    this.resetRun();
  }

  private recordPair(pair: Matter.Pair): void {
    const a = pair.bodyA;
    const b = pair.bodyB;
    let wheelBody: Matter.Body;
    let other: Matter.Body;
    if (a.label === TERRAIN_LABEL) {
      other = a;
      wheelBody = b;
    } else if (b.label === TERRAIN_LABEL) {
      other = b;
      wheelBody = a;
    } else return;
    let wheel: WheelId;
    if (wheelBody.label === WHEEL_FRONT_LABEL) wheel = 'front';
    else if (wheelBody.label === WHEEL_REAR_LABEL) wheel = 'rear';
    else return;

    let nx = pair.collision.normal.x;
    let ny = pair.collision.normal.y;
    const toWheelX = wheelBody.position.x - other.position.x;
    const toWheelY = wheelBody.position.y - other.position.y;
    if (nx * toWheelX + ny * toWheelY < 0) {
      nx = -nx;
      ny = -ny;
    }
    const support = pair.collision.supports[0];
    this.contacts.report(
      wheel,
      { x: nx, y: ny },
      support
        ? { x: support.x, y: support.y }
        : { x: wheelBody.position.x, y: wheelBody.position.y },
    );
  }

  /** Put everything back at the spawn point. Safe to call at any time, including mid-collision. */
  resetRun(): void {
    const { level } = this;
    this.terrain.activateAround(level.spawn.x);
    this.skateboard.reset(level.spawn);
    // Drop cached contact pairs; Engine.clear also empties the detector, so flag the world as modified
    // to make the next update rebuild its body list.
    Engine.clear(this.engine);
    (
      Matter.Composite as unknown as {
        setModified: (c: Matter.Composite, modified: boolean, deep: boolean, wide: boolean) => void;
      }
    ).setModified(this.engine.world, true, false, false);
    this.contacts.reset();
    this.jump.reset();
    this.pose.reset();
    this.time = 0;
    this.ticks = 0;
    this.status = 'running';
    this.victoryFired = false;
    this.immunityTicks = PHYSICS.spawnImmunityTicks;
    this.wasAirborne = true;
    this.lastInput = { tilt: 0, crouch: false };
    this.currRender = this.skateboard.transforms();
    this.prevRender = this.currRender;
  }

  get facing(): 1 | -1 {
    return this.level.spawnDirection;
  }

  /** Speed of the assembly in px/s. */
  get speed(): number {
    const v = this.skateboard.velocity();
    return Math.hypot(v.x, v.y) / DT;
  }

  get grounded(): boolean {
    return this.contacts.anyGrounded;
  }

  /** Head centre in world coordinates, synced with the animated pose. */
  headWorld(): Vec2 {
    return this.localToWorld(this.currentPose().head);
  }

  localToWorld(p: Vec2): Vec2 {
    const board = this.skateboard.board;
    const c = Math.cos(board.angle);
    const s = Math.sin(board.angle);
    return {
      x: board.position.x + p.x * c - p.y * s,
      y: board.position.y + p.x * s + p.y * c,
    };
  }

  currentPose(): Pose {
    return computePose(this.pose.params(this.facing));
  }

  /** Interpolated transforms for rendering between the previous and current tick. */
  interpolated(alpha: number): RenderTransforms {
    const mix = (a: Transform, b: Transform): Transform => ({
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      angle: a.angle + (b.angle - a.angle) * alpha,
    });
    return {
      board: mix(this.prevRender.board, this.currRender.board),
      front: mix(this.prevRender.front, this.currRender.front),
      rear: mix(this.prevRender.rear, this.currRender.rear),
    };
  }

  /** Advance exactly one fixed tick. */
  step(input: InputSample): void {
    if (this.status !== 'running') return;
    this.lastInput = input;
    const sb = this.skateboard;

    this.terrain.activateAround(sb.board.position.x);

    // Jump charge uses the contact state resolved by the previous tick's physics.
    const jumpEvent = this.jump.update({
      crouch: input.crouch,
      grounded: this.contacts.anyGrounded,
      dt: DT,
    });
    if (jumpEvent) this.applyJump(jumpEvent.speed, jumpEvent.charge01);

    this.applyControlForces(input);

    const preVel = sb.velocity();
    const subDelta = (DT * 1000) / PHYSICS.substeps;
    for (let i = 0; i < PHYSICS.substeps; i++) Engine.update(this.engine, subDelta);
    this.contacts.endTick();
    this.ticks++;

    this.prevRender = this.currRender;
    this.currRender = sb.transforms();

    if (!sb.isFinite()) {
      this.die('invalid');
      return;
    }

    const grounded = this.contacts.anyGrounded;
    if (grounded && this.wasAirborne) this.handleLanding(preVel);
    this.wasAirborne = !grounded;

    this.pose.update({
      crouchTarget: input.crouch ? 0.35 + 0.65 * this.jump.charge01 : 0,
      tilt: input.tilt,
      dt: DT,
    });

    this.time += DT;
    if (this.immunityTicks > 0) this.immunityTicks--;

    if (this.checkVictory()) return;
    if (sb.board.position.y > this.deathY) {
      this.die('void');
      return;
    }
    if (this.immunityTicks === 0 && this.headTouchesTerrain()) this.die('head');
  }

  private applyJump(speed: number, charge01: number): void {
    const sb = this.skateboard;
    const surface = this.contacts.groundNormal ?? { x: 0, y: -1 };
    const a = sb.board.angle;
    // Board "up": perpendicular to the deck, pointing from the deck toward the skater.
    const upX = Math.sin(a);
    const upY = -Math.cos(a);
    const w = PHYSICS.jump.normalWeight;
    let dx = surface.x * w + upX * (1 - w);
    let dy = surface.y * w + upY * (1 - w);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    // Cancel motion into the surface first so the launch is clean, then add the jump speed.
    const v = sb.velocity();
    const into = v.x * surface.x + v.y * surface.y;
    const cancel = into < 0 ? -into : 0;
    sb.addVelocity({
      x: surface.x * cancel + (dx * speed) / 60,
      y: surface.y * cancel + (dy * speed) / 60,
    });
    this.pose.onJump();
    this.hooks.onJump?.(charge01);
  }

  private applyControlForces(input: InputSample): void {
    const sb = this.skateboard;
    const grounded = this.contacts.anyGrounded;

    if (input.tilt !== 0) {
      const accel = grounded ? PHYSICS.groundTiltAcceleration : PHYSICS.tiltAcceleration;
      sb.addAngularVelocity(input.tilt * accel * DT * DT, this.tiltPivot(input.tilt));
    }
    if (grounded && input.tilt === 0) this.alignToGround();
    const damping = grounded ? PHYSICS.groundAngularDamping : PHYSICS.airAngularDamping;
    if (damping > 0) sb.addAngularVelocity(-sb.angularVelocity() * damping);
    sb.clampAngular((grounded ? PHYSICS.groundMaxAngularSpeed : PHYSICS.maxAngularSpeed) * DT);

    if (grounded) {
      this.applyPropulsion();
      sb.scaleVelocity(1 - PHYSICS.rollingResistance);
      this.applyGrip();
    }

    const v = sb.velocity();
    const maxPerTick = PHYSICS.maxSpeed * DT;
    const speed = Math.hypot(v.x, v.y);
    if (speed > maxPerTick) sb.scaleVelocity(maxPerTick / speed);
  }

  /** Ease the board toward the average ground normal; the board stays free to rotate with tilt input. */
  private alignToGround(): void {
    const normal = this.contacts.groundNormal;
    if (!normal) return;
    const sb = this.skateboard;
    const target = Math.atan2(normal.x, -normal.y);
    let err = target - sb.board.angle;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const cfg = PHYSICS.groundAlign;
    const omega = sb.angularVelocity();
    let d = cfg.acceleration * err * DT * DT - omega * cfg.damping;
    const limit = cfg.maxAngularSpeed * DT;
    d = Math.max(-limit - omega, Math.min(limit - omega, d));
    sb.addAngularVelocity(d);
  }

  /**
   * Clockwise tilt pushes the +x end of the deck down, so it pivots on the front wheel;
   * counterclockwise pivots on the rear wheel. If that wheel is off the ground, spin about the centre of mass.
   */
  private tiltPivot(tilt: -1 | 1): Vec2 | undefined {
    const wheel = tilt > 0 ? 'front' : 'rear';
    if (!this.contacts.wheel(wheel).grounded) return undefined;
    const body = tilt > 0 ? this.skateboard.wheelFront : this.skateboard.wheelRear;
    return { x: body.position.x, y: body.position.y };
  }

  /**
   * Grip on steep or overhead surfaces: while moving fast, press the assembly into the surface so a
   * quick rider can follow walls and ceilings (a rider has real weight shift and traction we do not simulate).
   */
  private applyGrip(): void {
    const normal = this.contacts.groundNormal;
    if (!normal || normal.y < PHYSICS.grip.maxFloorNormalY) return;
    const speedFactor = Math.min(
      1,
      Math.max(0, (this.speed - PHYSICS.grip.minSpeed) / PHYSICS.grip.rampSpeed),
    );
    if (speedFactor <= 0) return;
    const dv = PHYSICS.grip.acceleration * speedFactor * DT * DT;
    this.skateboard.addVelocity({ x: -normal.x * dv, y: -normal.y * dv });
  }

  private applyPropulsion(): void {
    const normal = this.contacts.groundNormal;
    if (!normal) return;
    const sb = this.skateboard;
    const dir = this.facing;
    const v = sb.velocity();
    let tx = -normal.y;
    let ty = normal.x;
    if (Math.abs(tx) < 0.2) {
      // Near-vertical surface: follow current motion, or climb when nearly still.
      const along = v.x * tx + v.y * ty;
      const sign = Math.abs(along) > 0.5 ? Math.sign(along) : ty < 0 ? 1 : -1;
      tx *= sign;
      ty *= sign;
    } else if (tx * dir < 0) {
      tx = -tx;
      ty = -ty;
    }
    const along = (v.x * tx + v.y * ty) / DT;
    const floorLike = normal.y < -0.5;
    const driveSign = !floorLike && along < -80 ? -1 : 1;
    const speedAlong = along * driveSign;
    const factor = Math.max(0, Math.min(1, 1 - speedAlong / PHYSICS.cruiseSpeed));
    const dv = PHYSICS.propulsion * factor * DT * DT * driveSign;
    sb.addVelocity({ x: tx * dv, y: ty * dv });
  }

  private handleLanding(preVel: Vec2): void {
    const n = this.contacts.groundNormal ?? { x: 0, y: -1 };
    const impact = Math.max(0, -(preVel.x * n.x + preVel.y * n.y) / DT);
    const impact01 = Math.min(1, impact / 900);
    if (impact01 > 0.05) {
      this.pose.onLand(impact01);
      this.hooks.onLand?.(impact01);
    }
  }

  private headTouchesTerrain(): boolean {
    Body.setPosition(this.headSensor, this.headWorld());
    return Query.collides(this.headSensor, this.terrain.activeBodies()).length > 0;
  }

  private checkVictory(): boolean {
    if (this.victoryFired) return true;
    Body.setPosition(this.headSensor, this.headWorld());
    const parts = [...this.skateboard.bodies, this.headSensor];
    if (Query.collides(this.flagSensor, parts).length === 0) return false;
    this.victoryFired = true;
    this.status = 'won';
    this.hooks.onVictory?.(this.time);
    return true;
  }

  private die(cause: DeathCause): void {
    const deaths = this.deaths + 1;
    this.hooks.onDeath?.(cause);
    this.resetRun();
    this.deaths = deaths;
  }

  /** Reset for a fresh attempt from outside (restart key / button). */
  restart(): void {
    this.deaths = 0;
    this.resetRun();
  }

  dispose(): void {
    Events.off(this.engine, 'collisionStart', this.onContact);
    Events.off(this.engine, 'collisionActive', this.onContact);
    this.terrain.dispose();
    this.skateboard.dispose();
    Matter.Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
