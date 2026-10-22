/** Shared domain types. Every other module imports level data shapes from here. */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A freehand stroke: control points of a smooth curve. Strokes are always independent. */
export interface Stroke {
  id: string;
  points: Vec2[];
}

export type SpawnDirection = 1 | -1;
export type LevelKind = 'builtin' | 'custom';

/**
 * Validation records which revision of the level was completed.
 * The level counts as validated only while `validatedRevision === level.revision`,
 * so any gameplay-relevant edit (which bumps the revision) invalidates it.
 */
export interface ValidationInfo {
  validatedRevision: number | null;
  completionTime: number | null;
  validatedAt: number | null;
}

export interface Level {
  id: string;
  name: string;
  kind: LevelKind;
  strokes: Stroke[];
  /** World position of the board centre at spawn. */
  spawn: Vec2;
  spawnDirection: SpawnDirection;
  /** World position of the flag pole base. */
  flag: Vec2;
  createdAt: number;
  updatedAt: number;
  revision: number;
  validation: ValidationInfo;
  /** Built-in only: short difficulty label for menus. */
  difficulty?: string;
}

/** The gameplay-relevant, user-editable part of a level (what the editor history tracks). */
export interface LevelContent {
  strokes: Stroke[];
  spawn: Vec2;
  spawnDirection: SpawnDirection;
  flag: Vec2;
}

export interface CompletionResult {
  levelId: string;
  time: number;
}
