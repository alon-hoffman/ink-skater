import type { Vec2 } from '../levels/levelTypes';

export interface CameraTarget {
  position: Vec2;
  /** Velocity in px/s. */
  velocity: Vec2;
  /** 1 or -1: travel direction, used to place the skater off-centre. */
  facing: 1 | -1;
}

export interface CameraView {
  x: number;
  y: number;
  scale: number;
}

/** World units we always want visible, so aspect ratio changes show more rather than less. */
const MIN_VIEW_W = 1000;
const MIN_VIEW_H = 560;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Smooth-follow side-scroller camera. Updated on the fixed physics tick;
 * rendering interpolates between the previous and current states.
 */
export class Camera {
  private viewW = 1000;
  private viewH = 560;
  private cur: CameraView = { x: 0, y: 0, scale: 1 };
  private prev: CameraView = { x: 0, y: 0, scale: 1 };
  private zoomBoost = 1;

  setViewport(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
  }

  get viewportWidth(): number {
    return this.viewW;
  }

  get viewportHeight(): number {
    return this.viewH;
  }

  private baseScale(): number {
    return Math.min(this.viewW / MIN_VIEW_W, this.viewH / MIN_VIEW_H);
  }

  /** Desired camera centre for a target, before smoothing. */
  private focus(target: CameraTarget, scale: number): Vec2 {
    const lookX = Math.max(-160, Math.min(160, target.velocity.x * 0.22));
    const lookY = Math.max(-90, Math.min(90, target.velocity.y * 0.08));
    // Skater sits left of centre when travelling right (and mirrored otherwise).
    const offset = (this.viewW * 0.14) / scale;
    return {
      x: target.position.x + lookX + target.facing * offset,
      y: target.position.y + lookY - (this.viewH * 0.06) / scale,
    };
  }

  snapTo(target: CameraTarget): void {
    this.zoomBoost = 1;
    const scale = this.baseScale();
    const f = this.focus({ ...target, velocity: { x: 0, y: 0 } }, scale);
    this.cur = { x: f.x, y: f.y, scale };
    this.prev = { ...this.cur };
  }

  update(dt: number, target: CameraTarget): void {
    this.prev = { ...this.cur };
    const speed = Math.hypot(target.velocity.x, target.velocity.y);
    const zoomTarget = 1 - 0.14 * Math.min(1, speed / 1200);
    this.zoomBoost += (zoomTarget - this.zoomBoost) * (1 - Math.exp(-dt * 1.5));
    const scale = this.baseScale() * this.zoomBoost;
    const f = this.focus(target, scale);
    this.cur.x += (f.x - this.cur.x) * (1 - Math.exp(-dt * 5.5));
    this.cur.y += (f.y - this.cur.y) * (1 - Math.exp(-dt * 3.2));
    this.cur.scale = scale;

    // Never let the skater leave the comfortable vertical band, however fast the fall.
    const bandY = (this.viewH * 0.36) / scale;
    const dy = target.position.y - this.cur.y;
    if (Math.abs(dy) > bandY) this.cur.y = target.position.y - Math.sign(dy) * bandY;
    const bandX = (this.viewW * 0.4) / scale;
    const dx = target.position.x - this.cur.x;
    if (Math.abs(dx) > bandX) this.cur.x = target.position.x - Math.sign(dx) * bandX;
  }

  interpolated(alpha: number): CameraView {
    return {
      x: lerp(this.prev.x, this.cur.x, alpha),
      y: lerp(this.prev.y, this.cur.y, alpha),
      scale: lerp(this.prev.scale, this.cur.scale, alpha),
    };
  }
}
