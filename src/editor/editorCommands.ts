import { translateStroke } from '../levels/geometry';
import type { LevelContent, SpawnDirection, Stroke, Vec2 } from '../levels/levelTypes';

/**
 * Pure edit operations on level content. Each returns a new content object and
 * shares unchanged strokes, so history snapshots are cheap and identity checks work.
 */

export function addStroke(doc: LevelContent, stroke: Stroke): LevelContent {
  return { ...doc, strokes: [...doc.strokes, stroke] };
}

export function deleteStroke(doc: LevelContent, id: string): LevelContent {
  if (!doc.strokes.some((s) => s.id === id)) return doc;
  return { ...doc, strokes: doc.strokes.filter((s) => s.id !== id) };
}

export function moveStroke(doc: LevelContent, id: string, dx: number, dy: number): LevelContent {
  if (dx === 0 && dy === 0) return doc;
  return {
    ...doc,
    strokes: doc.strokes.map((s) => (s.id === id ? translateStroke(s, dx, dy) : s)),
  };
}

export function setSpawn(doc: LevelContent, spawn: Vec2): LevelContent {
  return { ...doc, spawn: { x: spawn.x, y: spawn.y } };
}

export function setSpawnDirection(doc: LevelContent, direction: SpawnDirection): LevelContent {
  return doc.spawnDirection === direction ? doc : { ...doc, spawnDirection: direction };
}

export function setFlag(doc: LevelContent, flag: Vec2): LevelContent {
  return { ...doc, flag: { x: flag.x, y: flag.y } };
}

const HISTORY_LIMIT = 300;

/** Linear undo/redo history over immutable snapshots. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private current: T) {}

  get present(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Record a new state; clears redo. Identical states are ignored. */
  commit(next: T): boolean {
    if (next === this.current) return false;
    this.past.push(this.current);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.current = next;
    this.future = [];
    return true;
  }

  undo(): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.current);
    this.current = prev;
    return prev;
  }

  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.current);
    this.current = next;
    return next;
  }
}
