import type { Repositories } from '../levels/levelRepository';
import type { Level } from '../levels/levelTypes';
import { newCustomLevel } from '../levels/levelValidation';
import { newId } from './strokeProcessing';

export interface LoadedEditorLevel {
  level: Level;
  /** True when the level differs from what is saved (restored draft or brand-new level). */
  dirty: boolean;
  recovered: boolean;
}

/**
 * Decide what the editor opens with:
 * - a specific level (its newer draft wins, so refreshes never lose work),
 * - otherwise the most recent unsaved draft of a never-saved level (unless `fresh`),
 * - otherwise a brand-new level.
 */
export async function loadEditorLevel(args: {
  levelId: string | null;
  fresh: boolean;
  repos: Repositories;
  now: number;
}): Promise<LoadedEditorLevel> {
  const { levelId, fresh, repos, now } = args;
  if (levelId) {
    const [saved, draft] = await Promise.all([
      repos.levels.get(levelId),
      repos.drafts.get(levelId),
    ]);
    if (draft && (!saved || draft.level.updatedAt >= saved.updatedAt)) {
      return { level: draft.level, dirty: true, recovered: true };
    }
    if (saved) return { level: saved, dirty: false, recovered: false };
  }
  if (!fresh && !levelId) {
    const [drafts, saved] = await Promise.all([repos.drafts.list(), repos.levels.list()]);
    const savedIds = new Set(saved.map((l) => l.id));
    const orphan = drafts.find((d) => !savedIds.has(d.level.id));
    if (orphan) return { level: orphan.level, dirty: true, recovered: true };
  }
  const level = newCustomLevel({ id: levelId ?? newId('level'), name: 'Untitled Level', now });
  return { level, dirty: false, recovered: false };
}
