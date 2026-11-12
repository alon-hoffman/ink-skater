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
/** The kind of sketch paper a level is drawn on. */
export type PaperStyle = 'lined' | 'graph' | 'legal' | 'blueprint';

/** Built-in levels only: the targets for the two bonus objectives (finishing is always the first). */
export interface LevelObjectives {
  /** Finish within this many seconds. */
  timeLimit: number;
  /** Finish with at least this many trick points. */
  scoreTarget: number;
}

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
  /** Built-in only: which world (and so which paper) the level belongs to. */
  worldId?: string;
  /** Built-in only: time and score objectives. */
  objectives?: LevelObjectives;
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
  score: number;
}
