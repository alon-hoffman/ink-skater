import { strokeGeometry } from '../levels/geometry';
import type { PaperStyle, Stroke, Vec2 } from '../levels/levelTypes';
import type { Pose } from './Pose';
import { PHYSICS } from './physicsConfig';
import type { Transform } from './Skateboard';

/** Shared notebook-sketch drawing helpers used by the game renderer and the level editor. */

export const PAPER = '#f6f1e3';
export const INK = '#1f1f26';
export const LINE_BLUE = 'rgba(112, 150, 196, 0.32)';
export const MARGIN_RED = 'rgba(214, 98, 98, 0.32)';
export const RED_INK = '#c0392b';
export const RULE_SPACING = 32;

/** Colours used to draw the course and skater on each kind of paper. */
export interface PaperTheme {
  style: PaperStyle;
  paper: string;
  ink: string;
  /** The "red pen" colour: flag, charge ring, crash marks. */
  accent: string;
}

export const PAPER_THEMES: Record<PaperStyle, PaperTheme> = {
  lined: { style: 'lined', paper: PAPER, ink: INK, accent: RED_INK },
  graph: { style: 'graph', paper: '#f1f5ec', ink: INK, accent: RED_INK },
  legal: { style: 'legal', paper: '#f4e9a6', ink: INK, accent: RED_INK },
  blueprint: { style: 'blueprint', paper: '#1d4f91', ink: '#eef4ff', accent: '#ffc27a' },
};

export function paperTheme(style: PaperStyle | undefined): PaperTheme {
  return PAPER_THEMES[style ?? 'lined'];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

let paperTile: HTMLCanvasElement | null = null;

/** Small tiled canvas of faint paper grain, generated once. */
function getPaperTile(): HTMLCanvasElement {
  if (paperTile) return paperTile;
  const size = 192;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) {
    let s = 7;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    for (let i = 0; i < 1400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      g.fillStyle = rand() > 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.35)';
      g.fillRect(x, y, 1 + rand() * 1.5, 1 + rand() * 1.5);
    }
  }
  paperTile = c;
  return c;
}

/** Lines at every multiple of `spacing` in world space (vertical and/or horizontal), scrolled by the camera. */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  view: { x: number; y: number; scale: number },
  spacing: number,
  axes: { vertical: boolean; horizontal: boolean },
  every = 1,
): void {
  const { w, h } = size;
  const step = spacing * every * view.scale;
  if (step < 3) return;
  ctx.beginPath();
  if (axes.horizontal) {
    const first = Math.floor((view.y - h / 2 / view.scale) / (spacing * every)) * spacing * every;
    for (let wy = first; ; wy += spacing * every) {
      const sy = Math.round((wy - view.y) * view.scale + h / 2) + 0.5;
      if (sy > h) break;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
  }
  if (axes.vertical) {
    const first = Math.floor((view.x - w / 2 / view.scale) / (spacing * every)) * spacing * every;
    for (let wx = first; ; wx += spacing * every) {
      const sx = Math.round((wx - view.x) * view.scale + w / 2) + 0.5;
      if (sx > w) break;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
  }
  ctx.stroke();
}

/** Page in screen space. Rules and grids scroll with the camera; grain stays put. */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number; dpr: number },
  view: { x?: number; y: number; scale: number },
  style: PaperStyle = 'lined',
): void {
  const { w, h, dpr } = size;
  const theme = PAPER_THEMES[style];
  const v = { x: view.x ?? 0, y: view.y, scale: view.scale };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, w, h);
  const pattern = ctx.createPattern(getPaperTile(), 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = style === 'blueprint' ? 0.3 : 1;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  ctx.lineWidth = 1;
  const marginX = Math.round(Math.max(36, w * 0.07)) + 0.5;

  if (style === 'graph') {
    ctx.strokeStyle = 'rgba(56, 140, 120, 0.2)';
    drawGrid(ctx, size, v, RULE_SPACING, { vertical: true, horizontal: true });
    ctx.strokeStyle = 'rgba(56, 140, 120, 0.42)';
    drawGrid(ctx, size, v, RULE_SPACING, { vertical: true, horizontal: true }, 4);
    return;
  }

  if (style === 'blueprint') {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(0,10,40,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
    drawGrid(ctx, size, v, RULE_SPACING, { vertical: true, horizontal: true });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    drawGrid(ctx, size, v, RULE_SPACING, { vertical: true, horizontal: true }, 4);
    return;
  }

  ctx.strokeStyle = style === 'legal' ? 'rgba(66, 104, 170, 0.45)' : LINE_BLUE;
  drawGrid(ctx, size, v, RULE_SPACING, { vertical: false, horizontal: true });
  ctx.strokeStyle = style === 'legal' ? 'rgba(204, 64, 64, 0.55)' : MARGIN_RED;
  ctx.beginPath();
  ctx.moveTo(marginX, 0);
  ctx.lineTo(marginX, h);
  if (style === 'legal') {
    ctx.moveTo(marginX + 5, 0);
    ctx.lineTo(marginX + 5, h);
  }
  ctx.stroke();
}

interface InkPaths {
  main: Path2D;
  sketch: Path2D;
}
const inkCache = new WeakMap<Stroke, InkPaths>();

/** Hand-drawn look: tiny visual-only wobble plus a faint second pen pass. Collision is untouched. */
function inkPaths(stroke: Stroke): InkPaths {
  const hit = inkCache.get(stroke);
  if (hit) return hit;
  const seed = hashString(stroke.id) * 100;
  const dense = strokeGeometry(stroke).dense;
  const main = new Path2D();
  const sketch = new Path2D();
  dense.forEach((p, i) => {
    const dx = Math.sin(i * 0.05 + seed) * 0.35 + Math.sin(i * 0.13 + seed * 2) * 0.2;
    const dy = Math.cos(i * 0.045 + seed * 1.3) * 0.35 + Math.cos(i * 0.11 + seed) * 0.2;
    const sx = Math.sin(i * 0.037 + seed * 3) * 0.7 + 0.8;
    const sy = Math.cos(i * 0.041 + seed * 5) * 0.7 - 0.6;
    if (i === 0) {
      main.moveTo(p.x + dx, p.y + dy);
      sketch.moveTo(p.x + sx, p.y + sy);
    } else {
      main.lineTo(p.x + dx, p.y + dy);
      sketch.lineTo(p.x + sx, p.y + sy);
    }
  });
  const paths = { main, sketch };
  inkCache.set(stroke, paths);
  return paths;
}

export function drawStrokeInk(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  options: { width?: number; color?: string } = {},
): void {
  const { main, sketch } = inkPaths(stroke);
  const width = options.width ?? PHYSICS.terrain.halfThickness * 1.4;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = options.color ?? INK;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1, width * 0.45);
  ctx.stroke(sketch);
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  ctx.stroke(main);
  ctx.restore();
}

export function drawPolylineInk(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  options: { width?: number; color?: string } = {},
): void {
  const first = points[0];
  if (!first) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = options.color ?? INK;
  ctx.lineWidth = options.width ?? 5;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

export const FLAG_HEIGHT = 100;

export function drawFlag(
  ctx: CanvasRenderingContext2D,
  at: Vec2,
  time: number,
  theme: PaperTheme = PAPER_THEMES.lined,
): void {
  const top = at.y - FLAG_HEIGHT;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.quadraticCurveTo(at.x + 1.5, at.y - FLAG_HEIGHT / 2, at.x - 0.5, top);
  ctx.stroke();
  const wave = Math.sin(time * 5) * 4;
  ctx.beginPath();
  ctx.moveTo(at.x, top + 1);
  ctx.quadraticCurveTo(at.x + 22, top + 2 + wave, at.x + 48, top + 14 + wave * 0.6);
  ctx.quadraticCurveTo(at.x + 24, top + 24 + wave, at.x, top + 30);
  ctx.closePath();
  ctx.fillStyle = theme.style === 'blueprint' ? 'rgba(255, 194, 122, 0.3)' : 'rgba(192, 57, 43, 0.28)';
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(at.x + 6 + i * 8, top + 7 + wave * 0.3);
    ctx.lineTo(at.x + 2 + i * 8, top + 25 + wave * 0.3);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(at.x - 10, at.y + 1);
  ctx.lineTo(at.x + 10, at.y + 1);
  ctx.stroke();
  ctx.restore();
}

export interface SkaterTransforms {
  board: Transform;
  front: Transform;
  rear: Transform;
}

/** Draws wheels, deck and the stick figure. All geometry comes from physics + the deterministic pose. */
export function drawSkater(
  ctx: CanvasRenderingContext2D,
  t: SkaterTransforms,
  pose: Pose,
  options: { alpha?: number; theme?: PaperTheme } = {},
): void {
  const theme = options.theme ?? PAPER_THEMES.lined;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = theme.ink;

  for (const w of [t.front, t.rear]) {
    const r = PHYSICS.wheel.radius;
    ctx.fillStyle = theme.paper;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(w.x + Math.cos(w.angle) * (r - 3), w.y + Math.sin(w.angle) * (r - 3));
    ctx.lineTo(w.x - Math.cos(w.angle) * (r - 3), w.y - Math.sin(w.angle) * (r - 3));
    ctx.stroke();
  }

  ctx.translate(t.board.x, t.board.y);
  ctx.rotate(t.board.angle);

  const half = PHYSICS.board.length / 2;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(-half + 3, 0);
  ctx.lineTo(half - 3, 0);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-half + 3, 0);
  ctx.lineTo(-half - 3, -5);
  ctx.moveTo(half - 3, 0);
  ctx.lineTo(half + 3, -5);
  ctx.stroke();

  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(pose.footBack.x, pose.footBack.y);
  ctx.lineTo(pose.kneeBack.x, pose.kneeBack.y);
  ctx.lineTo(pose.hip.x, pose.hip.y);
  ctx.lineTo(pose.kneeFront.x, pose.kneeFront.y);
  ctx.lineTo(pose.footFront.x, pose.footFront.y);
  ctx.moveTo(pose.hip.x, pose.hip.y);
  ctx.lineTo(pose.shoulder.x, pose.shoulder.y);
  ctx.moveTo(pose.handBack.x, pose.handBack.y);
  ctx.lineTo(pose.elbowBack.x, pose.elbowBack.y);
  ctx.lineTo(pose.shoulder.x, pose.shoulder.y);
  ctx.lineTo(pose.elbowFront.x, pose.elbowFront.y);
  ctx.lineTo(pose.handFront.x, pose.handFront.y);
  ctx.stroke();

  ctx.fillStyle = theme.paper;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, pose.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
