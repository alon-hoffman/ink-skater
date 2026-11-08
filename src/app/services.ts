import { AudioManager } from '../game/AudioManager';
import { CloudLevels } from '../levels/cloudLevels';
import { MemoryStorage, createLocalRepositories } from '../levels/localLevelRepository';
import type { StorageLike } from '../levels/localLevelRepository';

/** localStorage when available (it can be blocked or throw), otherwise a session-only fallback. */
function pickStorage(): StorageLike {
  try {
    const probe = '__inkskater_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

const storage = pickStorage();
export const repositories = createLocalRepositories(storage);
export const cloud = new CloudLevels(storage);
export const audio = new AudioManager();
