import type { Level } from '../levels/levelTypes';
import type { CameraView } from './Camera';
import type { Effects } from './Effects';
import { RED_INK, drawFlag, drawPaper, drawSkater, drawStrokeInk } from './inkDrawing';
import { PHYSICS } from './physicsConfig';
import type { Simulation } from './Simulation';
import { strokeGeometry } from '../levels/geometry';

export interface RenderFrame {
  w: number;
  h: number;
  dpr: number;
  view: CameraView;
  alpha: number;
  /** Seconds of wall-clock animation time (flag flutter etc.). */
  clock: number;
  /** 0..1 intensity of the red death flash. */
  flash: number;
  /** Motion-line phase scroll. */
  speedLines: number;
}

/** Draws one frame of the game world. Pure presentation: reads simulation state, never writes it. */
export class GameRenderer {
  constructor(private readonly level: Level) {}

  render(ctx: CanvasRenderingContext2D, sim: Simulation, effects: Effects, f: RenderFrame): void {
    drawPaper(ctx, f, f.view);

    const { view } = f;
    ctx.setTransform(
      f.dpr * view.scale,
      0,
      0,
      f.dpr * view.scale,
      f.dpr * (f.w / 2 - view.x * view.scale),
      f.dpr * (f.h / 2 - view.y * view.scale),
    );

    const halfW = f.w / 2 / view.scale;
    const halfH = f.h / 2 / view.scale;
    const left = view.x - halfW - 20;
    const right = view.x + halfW + 20;
    const top = view.y - halfH - 20;
    const bottom = view.y + halfH + 20;

    for (const stroke of this.level.strokes) {
      const b = strokeGeometry(stroke).bounds;
      if (b.maxX < left || b.minX > right || b.maxY < top || b.minY > bottom) continue;
      drawStrokeInk(ctx, stroke);
    }

    drawFlag(ctx, this.level.flag, f.clock);

    const t = sim.interpolated(f.alpha);
    this.drawSpeedLines(ctx, sim, t.board, f);
    effects.draw(ctx);
    drawSkater(ctx, t, sim.currentPose());
    this.drawChargeRing(ctx, sim, t.board);

    if (f.flash > 0) this.drawFlash(ctx, f);
  }

  private drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    board: { x: number; y: number },
    f: RenderFrame,
  ): void {
    const speed = sim.speed;
    if (speed < 520) return;
    const strength = Math.min(1, (speed - 520) / 700);
    const v = sim.skateboard.velocity();
    const len = Math.hypot(v.x, v.y) || 1;
    const dx = v.x / len;
    const dy = v.y / len;
    ctx.save();
    ctx.strokeStyle = '#25252b';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.28 * strength;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const lane = ((i * 53 + Math.floor(f.speedLines * 6)) % 7) - 3;
      const ox = -dy * lane * 22 + (((i * 37 + f.speedLines * 90) % 140) - 70) * dx;
      const oy = dx * lane * 22 + (((i * 37 + f.speedLines * 90) % 140) - 70) * dy;
      const sx = board.x - dx * (70 + (i % 3) * 25) + ox;
      const sy = board.y - dy * (70 + (i % 3) * 25) + oy - 12;
      const l = 28 + strength * 40;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - dx * l, sy - dy * l);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawChargeRing(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    board: { x: number; y: number },
  ): void {
    if (!sim.jump.isCharging) return;
    const head = sim.headWorld();
    const c = sim.jump.charge01;
    const r = 16;
    const cx = head.x;
    const cy = head.y - PHYSICS.head.radius - 22;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(31,31,38,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = c > 0.95 ? RED_INK : '#1f1f26';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, c));
    ctx.stroke();
    ctx.restore();
    void board;
  }

  private drawFlash(ctx: CanvasRenderingContext2D, f: RenderFrame): void {
    ctx.save();
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    const g = ctx.createRadialGradient(f.w / 2, f.h / 2, f.h * 0.2, f.w / 2, f.h / 2, f.w * 0.65);
    g.addColorStop(0, `rgba(192, 57, 43, ${0.16 * f.flash})`);
    g.addColorStop(1, `rgba(192, 57, 43, ${0.55 * f.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, f.w, f.h);
    ctx.restore();
  }
}
