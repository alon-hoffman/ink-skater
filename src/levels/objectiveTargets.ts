import type { LevelObjectives } from './levelTypes';

/**
 * Bonus-objective targets for each built-in level.
 * Time limits are about 1.4x to 1.5x the time a scripted test player needs for a clean run.
 * Score targets are what a player can earn with a few flips or a couple of manuals along the way
 * (a flip is 100, a manual is 50 a second), so longer levels ask for more.
 */
export const OBJECTIVE_TARGETS: Readonly<Record<string, LevelObjectives>> = {
  // World 1: Notebook
  'builtin-1': { timeLimit: 11, scoreTarget: 100 },
  'builtin-2': { timeLimit: 17, scoreTarget: 150 },
  'builtin-9': { timeLimit: 16, scoreTarget: 100 },
  'builtin-3': { timeLimit: 13, scoreTarget: 150 },
  'builtin-16': { timeLimit: 42, scoreTarget: 300 },
  'builtin-23': { timeLimit: 38, scoreTarget: 200 },
  'builtin-24': { timeLimit: 30, scoreTarget: 150 },
  'builtin-25': { timeLimit: 40, scoreTarget: 300 },
  'builtin-26': { timeLimit: 41, scoreTarget: 250 },
  'builtin-27': { timeLimit: 41, scoreTarget: 300 },
  // World 2: Graph Paper
  'builtin-17': { timeLimit: 95, scoreTarget: 350 },
  'builtin-28': { timeLimit: 80, scoreTarget: 350 },
  'builtin-30': { timeLimit: 100, scoreTarget: 600 },
  'builtin-29': { timeLimit: 135, scoreTarget: 400 },
  'builtin-31': { timeLimit: 120, scoreTarget: 450 },
  'builtin-10': { timeLimit: 9, scoreTarget: 100 },
  'builtin-14': { timeLimit: 10, scoreTarget: 100 },
  'builtin-12': { timeLimit: 14, scoreTarget: 150 },
  'builtin-18': { timeLimit: 155, scoreTarget: 600 },
  // World 3: Legal Pad
  'builtin-11': { timeLimit: 20, scoreTarget: 100 },
  'builtin-7': { timeLimit: 32, scoreTarget: 150 },
  'builtin-8': { timeLimit: 32, scoreTarget: 150 },
  'builtin-13': { timeLimit: 33, scoreTarget: 150 },
  'builtin-32': { timeLimit: 65, scoreTarget: 300 },
  'builtin-33': { timeLimit: 80, scoreTarget: 350 },
  'builtin-34': { timeLimit: 65, scoreTarget: 500 },
  'builtin-35': { timeLimit: 105, scoreTarget: 400 },
  'builtin-36': { timeLimit: 110, scoreTarget: 450 },
  'builtin-19': { timeLimit: 125, scoreTarget: 600 },
  // World 4: Blueprint
  'builtin-20': { timeLimit: 75, scoreTarget: 400 },
  'builtin-37': { timeLimit: 115, scoreTarget: 500 },
  'builtin-21': { timeLimit: 105, scoreTarget: 500 },
  'builtin-38': { timeLimit: 115, scoreTarget: 500 },
  'builtin-39': { timeLimit: 110, scoreTarget: 600 },
  'builtin-5': { timeLimit: 18, scoreTarget: 250 },
  'builtin-15': { timeLimit: 12, scoreTarget: 200 },
  'builtin-22': { timeLimit: 140, scoreTarget: 700 },
};
