import type { PaperStyle } from './levelTypes';

/**
 * Worlds group built-in levels. A world shares one paper look and one kind of challenge.
 * Worlds open in order: finishing a world's last level opens the next world.
 */
export interface World {
  id: string;
  name: string;
  /** The shared challenge, in a few words. */
  theme: string;
  blurb: string;
  paper: PaperStyle;
  /** Level ids in play order. The last one is the world's finale. */
  levelIds: readonly string[];
}

export const WORLDS: readonly World[] = [
  {
    id: 'notebook',
    name: 'Notebook',
    theme: 'Learn to Roll',
    blurb: 'Hills, small gaps and your first jumps.',
    paper: 'lined',
    levelIds: [
      'builtin-1',
      'builtin-2',
      'builtin-9',
      'builtin-3',
      'builtin-23',
      'builtin-24',
      'builtin-25',
      'builtin-26',
      'builtin-27',
      'builtin-16',
    ],
  },
  {
    id: 'graph',
    name: 'Graph Paper',
    theme: 'Gaps & Jumps',
    blurb: 'Measure your jumps: wider gaps, steeper landings.',
    paper: 'graph',
    levelIds: [
      'builtin-10',
      'builtin-14',
      'builtin-12',
      'builtin-17',
      'builtin-28',
      'builtin-30',
      'builtin-29',
      'builtin-31',
      'builtin-18',
    ],
  },
  {
    id: 'legal',
    name: 'Legal Pad',
    theme: 'Tight Spaces & Turnarounds',
    blurb: 'Low ceilings, dead ends and turning back.',
    paper: 'legal',
    levelIds: [
      'builtin-11',
      'builtin-7',
      'builtin-8',
      'builtin-13',
      'builtin-32',
      'builtin-33',
      'builtin-34',
      'builtin-35',
      'builtin-36',
      'builtin-19',
    ],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    theme: 'Big Air & Speed',
    blurb: 'Huge launches, half-pipes and long fast runs.',
    paper: 'blueprint',
    levelIds: [
      'builtin-5',
      'builtin-15',
      'builtin-20',
      'builtin-37',
      'builtin-21',
      'builtin-38',
      'builtin-39',
      'builtin-22',
    ],
  },
];

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function worldOfLevel(levelId: string): World | undefined {
  return WORLDS.find((w) => w.levelIds.includes(levelId));
}

/**
 * World 1 is always open; every later world opens when the previous world's finale is finished.
 * `npm run dev` (mode "development") opens every world; `npm run dev:locked` and production builds
 * keep the restriction.
 */
export function isWorldUnlocked(worldIndex: number, finished: ReadonlySet<string>): boolean {
  if (import.meta.env.MODE === 'development') return true;
  if (worldIndex <= 0) return true;
  const previous = WORLDS[worldIndex - 1];
  if (!previous) return false;
  const finale = previous.levelIds[previous.levelIds.length - 1];
  return finale !== undefined && finished.has(finale);
}
