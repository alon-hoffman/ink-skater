import type { LevelObjectives } from './levelTypes';

/**
 * Every built-in level has three separate objectives:
 *  - finish: reach the flag
 *  - time: reach the flag within the level's time limit
 *  - score: reach the flag with at least the level's trick-point target
 * They are independent checkmarks, not ranks.
 */
export interface ObjectiveResult {
  finish: boolean;
  time: boolean;
  score: boolean;
}

export const NO_OBJECTIVES: ObjectiveResult = { finish: false, time: false, score: false };

/** What is remembered per level on this device: which objectives were ever achieved, and the best score. */
export interface LevelProgress extends ObjectiveResult {
  bestScore: number;
}

export function evaluateObjectives(
  objectives: LevelObjectives | undefined,
  time: number,
  score: number,
): ObjectiveResult {
  return {
    finish: true,
    time: objectives ? time <= objectives.timeLimit : false,
    score: objectives ? score >= objectives.scoreTarget : false,
  };
}

/** Objectives stay ticked once earned; the best score only goes up. */
export function mergeProgress(
  previous: LevelProgress | undefined,
  result: ObjectiveResult,
  score: number,
): LevelProgress {
  return {
    finish: (previous?.finish ?? false) || result.finish,
    time: (previous?.time ?? false) || result.time,
    score: (previous?.score ?? false) || result.score,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
  };
}

/**
 * What is known about a level from saved data. Saves made before objectives existed only hold a best time;
 * that time proves the level was finished, and proves the time objective if it was within the limit.
 */
export function knownProgress(
  objectives: LevelObjectives | undefined,
  bestTime: number | null | undefined,
  saved: LevelProgress | undefined,
): LevelProgress | undefined {
  if (bestTime === null || bestTime === undefined) return saved;
  return {
    finish: true,
    time: (saved?.time ?? false) || (objectives !== undefined && bestTime <= objectives.timeLimit),
    score: saved?.score ?? false,
    bestScore: saved?.bestScore ?? 0,
  };
}

export function formatLimit(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
