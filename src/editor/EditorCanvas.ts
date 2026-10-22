import { computePose } from '../game/Pose';
import { PHYSICS } from '../game/physicsConfig';
import { computeDeathY } from '../game/Terrain';
import {
  INK,
  RED_INK,
  drawFlag,
  drawPaper,
  drawPolylineInk,
  drawSkater,
  drawStrokeInk,
} from '../game/inkDrawing';
import { boundsOf, strokeGeometry, translateStroke } from '../levels/geometry';
import type { LevelContent, Vec2 } from '../levels/levelTypes';

export interface EditorView {
  cx: number;
  cy: number;
  zoom: number;
}

export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 4;

export interface EditorRenderState {
  content: LevelContent;
  selectedId: string | null;
  /** In-progress freehand points (world space). */
  drawing: Vec2[] | null;
  /** Live drag offset applied to the selected stroke while moving. */
  moveOffset: Vec2 | null;
}

const HIGHLIGHT = '#2f6fb3';

/** Canvas rendering and view maths for the editor. Shares drawing code with the game. */
export class EditorCanvas {
  view: EditorView = { cx: 400, cy: 200, zoom: 0.7 };
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
  }

  get width(): number {
    return this.cssW;
  }

  get height(): number {
    return this.cssH;
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const { cx, cy, zoom } = this.view;
    return { x: (sx - this.cssW / 2) / zoom + cx, y: (sy - this.cssH / 2) / zoom + cy };
  }

  /** Zoom keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.zoom * factor));
    this.view.zoom = zoom;
    const after = this.screenToWorld(sx, sy);
    this.view.cx += before.x - after.x;
    this.view.cy += before.y - after.y;
  }

  panByScreen(dx: number, dy: number): void {
    this.view.cx -= dx / this.view.zoom;
    this.view.cy -= dy / this.view.zoom;
  }

  /** Frame everything in the level with a margin. */
  fit(content: LevelContent): void {
    const pts: Vec2[] = [
      content.spawn,
      content.flag,
      { x: content.flag.x, y: content.flag.y - 110 },
    ];
    for (const s of content.strokes) {
      const b = strokeGeometry(s).bounds;
      pts.push({ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY });
    }
    const b = boundsOf(pts);
    const w = Math.max(200, b.maxX - b.minX);
    const h = Math.max(200, b.maxY - b.minY);
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((this.cssW * 0.86) / w, (this.cssH * 0.8) / h)),
    );
    this.view = { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, zoom };
  }

  render(state: EditorRenderState): void {
    const { ctx } = this;
    const size = { w: this.cssW, h: this.cssH, dpr: this.dpr };
    const { cx, cy, zoom } = this.view;
    drawPaper(ctx, size, { y: cy, scale: zoom });
    ctx.setTransform(
      this.dpr * zoom,
      0,
      0,
      this.dpr * zoom,
      this.dpr * (this.cssW / 2 - cx * zoom),
      this.dpr * (this.cssH / 2 - cy * zoom),
    );
    const inkWidth = Math.max(PHYSICS.terrain.halfThickness * 1.4, 1.6 / zoom);
    const { content } = state;

    this.drawVoidLine(content, zoom);

    for (const stroke of content.strokes) {
      const selected = stroke.id === state.selectedId;
      const shown =
        selected && state.moveOffset
          ? translateStroke(stroke, state.moveOffset.x, state.moveOffset.y)
          : stroke;
      if (selected) {
        drawStrokeInk(ctx, shown, { width: inkWidth + 7 / zoom, color: 'rgba(47,111,179,0.28)' });
      }
      drawStrokeInk(ctx, shown, { width: inkWidth, color: selected ? HIGHLIGHT : INK });
    }

    if (state.drawing && state.drawing.length > 1) {
      drawPolylineInk(ctx, state.drawing, { width: inkWidth, color: 'rgba(31,31,38,0.6)' });
    }

    drawFlag(ctx, content.flag, 0);
    this.drawSpawn(content);
  }

  private drawVoidLine(content: LevelContent, zoom: number): void {
    const { ctx } = this;
    const y = computeDeathY({ strokes: content.strokes, spawn: content.spawn, flag: content.flag });
    ctx.save();
    ctx.setLineDash([16 / zoom, 12 / zoom]);
    ctx.strokeStyle = 'rgba(192,57,43,0.4)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(this.view.cx - this.cssW / zoom, y);
    ctx.lineTo(this.view.cx + this.cssW / zoom, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(192,57,43,0.55)';
    ctx.font = `${Math.max(12, 14 / zoom)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    ctx.fillText(
      'falling here restarts',
      this.view.cx - this.cssW / 2 / zoom + 12 / zoom,
      y - 8 / zoom,
    );
    ctx.restore();
  }

  private drawSpawn(content: LevelContent): void {
    const { ctx } = this;
    const { spawn, spawnDirection } = content;
    const w = PHYSICS.wheel;
    const pose = computePose({ crouch: 0, extend: 0, landing: 0, lean: 0, facing: spawnDirection });
    drawSkater(
      ctx,
      {
        board: { x: spawn.x, y: spawn.y, angle: 0 },
        front: { x: spawn.x + w.offsetX, y: spawn.y + w.offsetY, angle: 0.6 },
        rear: { x: spawn.x - w.offsetX, y: spawn.y + w.offsetY, angle: 0.2 },
      },
      pose,
      { alpha: 0.95 },
    );
    const ax = spawn.x + spawnDirection * 56;
    const ay = spawn.y - 30;
    ctx.save();
    ctx.strokeStyle = RED_INK;
    ctx.fillStyle = RED_INK;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax - spawnDirection * 20, ay);
    ctx.lineTo(ax + spawnDirection * 10, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + spawnDirection * 16, ay);
    ctx.lineTo(ax + spawnDirection * 6, ay - 7);
    ctx.lineTo(ax + spawnDirection * 6, ay + 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
