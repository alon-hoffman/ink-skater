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
/** The shared Google Apps Script web app that every player's game connects to by default. */
export const DEFAULT_CLOUD_URL =
  'https://script.google.com/macros/s/AKfycbxx5QkAHNTpf1o5W_uUOT1kq1SLkY49JQD-jXCe-CzlQCm4lA3cXxBAcyiARk6Ehp6Xjg/exec';
export const cloud = new CloudLevels(storage, undefined, DEFAULT_CLOUD_URL);
export const audio = new AudioManager();
