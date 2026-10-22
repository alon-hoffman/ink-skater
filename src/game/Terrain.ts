import Matter from 'matter-js';
import { PHYSICS } from './physicsConfig';
import { strokeGeometry } from '../levels/geometry';
import type { Level, Stroke } from '../levels/levelTypes';

export const TERRAIN_LABEL = 'terrain';
export const TERRAIN_CATEGORY = 0x0001;

const { Bodies, Composite } = Matter;

/** Build the thin rectangles for one stroke. Interior joints overlap slightly so curves have no gaps. */
export function buildStrokeBodies(stroke: Stroke): Matter.Body[] {
  const line = strokeGeometry(stroke).collision;
  const bodies: Matter.Body[] = [];
  const t = PHYSICS.terrain.halfThickness;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.5) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const extStart = i > 1 ? 2 : 0;
    const extEnd = i < line.length - 1 ? 2 : 0;
    const sx = a.x - ux * extStart;
    const sy = a.y - uy * extStart;
    const ex = b.x + ux * extEnd;
    const ey = b.y + uy * extEnd;
    const body = Bodies.rectangle((sx + ex) / 2, (sy + ey) / 2, len + extStart + extEnd, t * 2, {
      isStatic: true,
      angle: Math.atan2(uy, ux),
      friction: PHYSICS.terrain.friction,
      frictionStatic: 1,
      restitution: 0,
      label: TERRAIN_LABEL,
      collisionFilter: { category: TERRAIN_CATEGORY, mask: 0xffff, group: 0 },
    });
    bodies.push(body);
  }
  return bodies;
}

/**
 * Terrain is bucketed into vertical columns; only columns near the skater live in the Matter world.
 * That keeps broadphase cost independent of level length.
 */
export class Terrain {
  private readonly columns = new Map<number, Matter.Body[]>();
  private readonly active = new Set<number>();
  readonly bodyCount: number;

  constructor(
    private readonly world: Matter.World,
    strokes: readonly Stroke[],
  ) {
    let count = 0;
    const width = PHYSICS.terrain.columnWidth;
    for (const stroke of strokes) {
      for (const body of buildStrokeBodies(stroke)) {
        count++;
        const c0 = Math.floor(body.bounds.min.x / width);
        const c1 = Math.floor(body.bounds.max.x / width);
        for (let c = c0; c <= c1; c++) {
          const list = this.columns.get(c) ?? [];
          list.push(body);
          this.columns.set(c, list);
        }
      }
    }
    this.bodyCount = count;
  }

  /** Make sure columns around `x` are in the world and far ones are removed. */
  activateAround(x: number): void {
    const width = PHYSICS.terrain.columnWidth;
    const center = Math.floor(x / width);
    const wanted = new Set<number>();
    for (
      let c = center - PHYSICS.terrain.activeColumns;
      c <= center + PHYSICS.terrain.activeColumns;
      c++
    )
      wanted.add(c);
    for (const c of [...this.active]) {
      if (!wanted.has(c)) this.deactivateColumn(c);
    }
    for (const c of wanted) {
      if (!this.active.has(c)) this.activateColumn(c);
    }
  }

  private inOtherActive(body: Matter.Body, exceptColumn: number): boolean {
    const width = PHYSICS.terrain.columnWidth;
    const c0 = Math.floor(body.bounds.min.x / width);
    const c1 = Math.floor(body.bounds.max.x / width);
    for (let c = c0; c <= c1; c++) if (c !== exceptColumn && this.active.has(c)) return true;
    return false;
  }

  private activateColumn(c: number): void {
    this.active.add(c);
    for (const body of this.columns.get(c) ?? []) {
      if (!Composite.get(this.world, body.id, 'body')) Composite.add(this.world, body);
    }
  }

  private deactivateColumn(c: number): void {
    this.active.delete(c);
    for (const body of this.columns.get(c) ?? []) {
      if (!this.inOtherActive(body, c)) Composite.remove(this.world, body);
    }
  }

  /** Terrain bodies currently in the world. */
  activeBodies(): Matter.Body[] {
    return Composite.allBodies(this.world).filter((b) => b.label === TERRAIN_LABEL);
  }

  dispose(): void {
    for (const c of [...this.active]) this.deactivateColumn(c);
    this.columns.clear();
  }
}

/** Lowest relevant y of the level plus margin: falling below it is fatal. */
export function computeDeathY(level: Pick<Level, 'strokes' | 'spawn' | 'flag'>): number {
  let lowest = Math.max(level.spawn.y, level.flag.y);
  for (const stroke of level.strokes) {
    lowest = Math.max(lowest, strokeGeometry(stroke).bounds.maxY);
  }
  return lowest + PHYSICS.deathMargin;
}
