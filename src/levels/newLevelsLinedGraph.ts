import { builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level } from './levelTypes';

/**
 * Level 16: the Notebook world's long finale.
 * Coordinates: y grows downward, the travel direction is +x.
 */

/** Level 16: a very long, forgiving ride: rolling hills, long flats and a few small gaps. */
export function longHaul(): Level {
  const a = join(
    line(-420, 0, 400, 0),
    curve([400, 0], [800, 80], [1200, 60], [1600, 150], [2000, 120], [2300, 160]),
    line(2300, 160, 2400, 160),
  );
  const b = join(
    line(2600, 160, 3200, 160),
    curve([3200, 160], [3600, 100], [4000, 180], [4400, 260], [4800, 230]),
    line(4800, 230, 5400, 230),
  );
  const c = join(
    line(5620, 230, 6200, 230),
    curve([6200, 230], [6600, 300], [7000, 200], [7400, 260], [7800, 200], [8200, 250]),
    line(8200, 250, 8300, 250),
  );
  const d = line(8540, 250, 9800, 250);
  return builtInLevel({
    id: 'builtin-16',
    name: 'Long Haul',
    difficulty: 'Easy',
    strokes: [stroke('l16-a', a), stroke('l16-b', b), stroke('l16-c', c), stroke('l16-d', d)],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(9400, 250),
  });
}
