import type { Level, LevelContent, Vec2 } from './levelTypes';

/** A level is validated only while the recorded revision is the current one. */
export function isValidated(level: Level): boolean {
  return (
    level.validation.validatedRevision !== null &&
    level.validation.validatedRevision === level.revision
  );
}

export function contentOf(level: Level): LevelContent {
  return {
    strokes: level.strokes,
    spawn: level.spawn,
    spawnDirection: level.spawnDirection,
    flag: level.flag,
  };
}

const samePoint = (a: Vec2, b: Vec2): boolean => a.x === b.x && a.y === b.y;

/** Equality of gameplay-relevant content (strokes compared by identity first, then by value). */
export function sameContent(a: LevelContent, b: LevelContent): boolean {
  if (a === b) return true;
  if (a.spawnDirection !== b.spawnDirection) return false;
  if (!samePoint(a.spawn, b.spawn) || !samePoint(a.flag, b.flag)) return false;
  if (a.strokes === b.strokes) return true;
  if (a.strokes.length !== b.strokes.length) return false;
  return a.strokes.every((s, i) => {
    const o = b.strokes[i];
    if (!o) return false;
    if (s === o) return true;
    return (
      s.id === o.id &&
      s.points.length === o.points.length &&
      s.points.every((p, j) => {
        const q = o.points[j];
        return q !== undefined && samePoint(p, q);
      })
    );
  });
}

/**
 * Apply an edit to the gameplay content. Any real change bumps the revision,
 * which implicitly invalidates an earlier validation.
 */
export function applyContentEdit(level: Level, content: LevelContent, now: number): Level {
  if (sameContent(contentOf(level), content)) return level;
  return {
    ...level,
    ...content,
    revision: level.revision + 1,
    updatedAt: now,
  };
}

export function renameLevel(level: Level, name: string, now: number): Level {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed === level.name) return level;
  return { ...level, name: trimmed.slice(0, 60), updatedAt: now };
}

/**
 * Record a successful completion. Ignored (level returned unchanged) when the completed
 * revision is not the current one, so a stale playtest can never validate newer edits.
 */
export function recordValidation(
  level: Level,
  completed: { revision: number; time: number; at: number },
): Level {
  if (completed.revision !== level.revision) return level;
  return {
    ...level,
    validation: {
      validatedRevision: level.revision,
      completionTime: completed.time,
      validatedAt: completed.at,
    },
  };
}

/** A future online publishing flow can gate on this. */
export function canPublish(level: Level): boolean {
  return level.kind === 'custom' && isValidated(level);
}

export function newCustomLevel(args: { id: string; name: string; now: number }): Level {
  return {
    id: args.id,
    name: args.name,
    kind: 'custom',
    strokes: [
      {
        id: `${args.id}-ground`,
        points: [
          { x: -200, y: 300 },
          { x: -100, y: 300 },
          { x: 0, y: 300 },
          { x: 100, y: 300 },
          { x: 200, y: 300 },
          { x: 300, y: 300 },
          { x: 400, y: 300 },
          { x: 500, y: 300 },
          { x: 600, y: 300 },
          { x: 700, y: 300 },
          { x: 800, y: 300 },
        ],
      },
    ],
    spawn: { x: -120, y: 276 },
    spawnDirection: 1,
    flag: { x: 740, y: 296 },
    createdAt: args.now,
    updatedAt: args.now,
    revision: 1,
    validation: { validatedRevision: null, completionTime: null, validatedAt: null },
  };
}

export function duplicateLevel(
  level: Level,
  args: { id: string; name: string; now: number },
): Level {
  const copy: Level = {
    ...level,
    id: args.id,
    name: args.name,
    kind: 'custom',
    createdAt: args.now,
    updatedAt: args.now,
    revision: 1,
    validation: { validatedRevision: null, completionTime: null, validatedAt: null },
  };
  delete copy.difficulty;
  return copy;
}
