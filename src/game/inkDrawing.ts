import { strokeGeometry } from '../levels/geometry';
import type { Stroke, Vec2 } from '../levels/levelTypes';
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

/** Notebook page in screen space. Rules scroll vertically with the camera, grain stays put. */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number; dpr: number },
  view: { y: number; scale: number },
): void {
  const { w, h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const pattern = ctx.createPattern(getPaperTile(), 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = LINE_BLUE;
  ctx.lineWidth = 1;
  const spacing = RULE_SPACING * view.scale;
  const first = Math.floor((view.y - h / 2 / view.scale) / RULE_SPACING) * RULE_SPACING;
  ctx.beginPath();
  for (let wy = first; ; wy += RULE_SPACING) {
    const sy = Math.round((wy - view.y) * view.scale + h / 2) + 0.5;
    if (sy > h) break;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    if (spacing < 3) break;
  }
  ctx.stroke();
  const marginX = Math.round(Math.max(36, w * 0.07)) + 0.5;
  ctx.strokeStyle = MARGIN_RED;
  ctx.beginPath();
  ctx.moveTo(marginX, 0);
  ctx.lineTo(marginX, h);
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

export function drawFlag(ctx: CanvasRenderingContext2D, at: Vec2, time: number): void {
  const top = at.y - FLAG_HEIGHT;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
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
  ctx.fillStyle = 'rgba(192, 57, 43, 0.28)';
  ctx.fill();
  ctx.strokeStyle = RED_INK;
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
  ctx.strokeStyle = INK;
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
  options: { alpha?: number } = {},
): void {
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;

  for (const w of [t.front, t.rear]) {
    const r = PHYSICS.wheel.radius;
    ctx.fillStyle = PAPER;
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

  ctx.fillStyle = PAPER;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(pose.head.x, pose.head.y, pose.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
