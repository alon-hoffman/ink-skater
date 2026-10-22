import type { Vec2 } from '../levels/levelTypes';
import { PHYSICS } from './physicsConfig';

/** Pose inputs, all derived from simulation state (never from wall-clock time). */
export interface PoseParams {
  /** 0 standing .. 1 deep crouch. */
  crouch: number;
  /** 0..1 legs extended after a jump. */
  extend: number;
  /** 0..1 landing squash. */
  landing: number;
  /** -1..1 smoothed tilt input (positive = clockwise). */
  lean: number;
  /** 1 or -1: which way the skater faces. */
  facing: 1 | -1;
}

export interface Pose {
  head: Vec2;
  headRadius: number;
  shoulder: Vec2;
  hip: Vec2;
  footFront: Vec2;
  footBack: Vec2;
  kneeFront: Vec2;
  kneeBack: Vec2;
  handFront: Vec2;
  handBack: Vec2;
  elbowFront: Vec2;
  elbowBack: Vec2;
}

const THIGH = 14;
const SHIN = 14;
const TORSO = 22;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function knee(hip: Vec2, foot: Vec2, facing: number): Vec2 {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.1);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - (d / 2) * (d / 2)));
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (nx * facing < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: (hip.x + foot.x) / 2 + nx * h, y: (hip.y + foot.y) / 2 + ny * h };
}

/** Pose in board-local coordinates (origin = deck centre, y down, mirrored by facing). */
export function computePose(p: PoseParams): Pose {
  const f = p.facing;
  const crouch = Math.min(1, p.crouch + p.landing * 0.5);
  const footY = -PHYSICS.board.thickness / 2 - 1;
  const footFront = { x: 17 * f, y: footY };
  const footBack = { x: -17 * f, y: footY };
  const standHip = 27 + p.extend * 1.5;
  const hipHeight = lerp(standHip, 13, crouch);
  const hip = { x: -1 * f + p.lean * 2, y: footY - hipHeight };
  const a = crouch * 0.38 * f + p.lean * 0.3;
  const shoulder = { x: hip.x + Math.sin(a) * TORSO, y: hip.y - Math.cos(a) * TORSO };
  const head = {
    x: shoulder.x + Math.sin(a) * (PHYSICS.head.radius + 4),
    y: shoulder.y - Math.cos(a) * (PHYSICS.head.radius + 4),
  };

  const armUp = p.extend * 16;
  const handFront = {
    x: shoulder.x + f * (17 - crouch * 3),
    y: shoulder.y + 3 + crouch * 6 - armUp - p.lean * f * 9,
  };
  const handBack = {
    x: shoulder.x - f * (17 - crouch * 3),
    y: shoulder.y + 3 + crouch * 6 - armUp + p.lean * f * 9,
  };
  const elbow = (hand: Vec2): Vec2 => ({
    x: (shoulder.x + hand.x) / 2,
    y: (shoulder.y + hand.y) / 2 + 3,
  });

  return {
    head,
    headRadius: PHYSICS.head.radius,
    shoulder,
    hip,
    footFront,
    footBack,
    kneeFront: knee(hip, footFront, f),
    kneeBack: knee(hip, footBack, f),
    handFront,
    handBack,
    elbowFront: elbow(handFront),
    elbowBack: elbow(handBack),
  };
}

/** Deterministic pose animation state, advanced once per physics tick. */
export class PoseAnimator {
  crouch = 0;
  extend = 0;
  landing = 0;
  lean = 0;

  reset(): void {
    this.crouch = 0;
    this.extend = 0;
    this.landing = 0;
    this.lean = 0;
  }

  onJump(): void {
    this.extend = 1;
  }

  onLand(impact01: number): void {
    this.landing = Math.max(this.landing, Math.min(1, impact01));
  }

  update(args: { crouchTarget: number; tilt: number; dt: number }): void {
    const k = 1 - Math.exp(-args.dt * 14);
    this.crouch += (args.crouchTarget - this.crouch) * k;
    this.lean += (args.tilt - this.lean) * (1 - Math.exp(-args.dt * 10));
    this.extend = Math.max(0, this.extend - args.dt * 3.5);
    this.landing = Math.max(0, this.landing - args.dt * 4);
  }

  params(facing: 1 | -1): PoseParams {
    return {
      crouch: this.crouch,
      extend: this.extend,
      landing: this.landing,
      lean: this.lean,
      facing,
    };
  }
}
