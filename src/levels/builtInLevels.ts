import { arc, builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level } from './levelTypes';

/**
 * Hand-built courses. They use exactly the same stroke format as custom levels.
 * Coordinates: y grows downward, the travel direction is +x.
 */

/**
 * Tall wall that curves over into an overhead ceiling heading back (-x).
 * The wall base sits at (xw, floorY); total floor-to-ceiling height is 2R + H.
 */
function wallToCeiling(args: {
  xw: number;
  floorY: number;
  radius: number;
  height: number;
  ceilingLength: number;
}) {
  const { xw, floorY, radius: R, height: H, ceilingLength } = args;
  const top = floorY - 2 * R - H;
  return join(
    arc(xw, floorY - R, R, Math.PI / 2, 0),
    line(xw + R, floorY - R, xw + R, floorY - R - H),
    arc(xw, floorY - R - H, R, 0, -Math.PI / 2),
    line(xw, top, xw - ceilingLength, top),
  );
}

/** Level 1: gentle rolling hills, no precision needed. */
function firstRide(): Level {
  const ground = join(
    line(-420, 0, 300, 0),
    curve(
      [300, 0],
      [650, 90],
      [1050, 140],
      [1450, 110],
      [1850, 210],
      [2250, 240],
      [2650, 190],
      [2900, 200],
    ),
    line(2900, 200, 3400, 200),
  );
  return builtInLevel({
    id: 'builtin-1',
    name: 'First Ride',
    difficulty: 'Very easy',
    strokes: [stroke('l1-ground', ground)],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(2900, 200),
  });
}

/** Level 2: two modest gaps. */
function firstJump(): Level {
  const a = join(
    line(-420, 0, 500, 0),
    curve([500, 0], [700, 40], [950, 60]),
    line(950, 60, 1060, 60),
  );
  const b = join(
    line(1260, 60, 1700, 60),
    curve([1700, 60], [1850, 40], [2000, 60]),
    line(2000, 60, 2100, 60),
  );
  const c = line(2300, 60, 3300, 60);
  return builtInLevel({
    id: 'builtin-2',
    name: 'First Jump',
    difficulty: 'Easy',
    strokes: [stroke('l2-a', a), stroke('l2-b', b), stroke('l2-c', c)],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(3000, 60),
  });
}

/** Level 3: ride down a hill, launch off a kicker, land on a slope, then a momentum valley and a second gap. */
function airTime(): Level {
  const run = join(
    line(-420, -480, 150, -480),
    curve([150, -480], [450, -460], [800, -250], [1100, 0], [1400, 150]),
    curve([1400, 150], [1560, 150], [1660, 112], [1740, 72]),
  );
  const landing = join(
    curve([2190, 180], [2440, 265], [2700, 310], [3000, 320]),
    curve([3000, 320], [3250, 320], [3450, 270], [3620, 200]),
    line(3620, 200, 3900, 200),
  );
  const final = line(4200, 200, 4900, 200);
  return builtInLevel({
    id: 'builtin-3',
    name: 'Air Time',
    difficulty: 'Medium',
    strokes: [stroke('l3-run', run), stroke('l3-landing', landing), stroke('l3-final', final)],
    spawn: pt(60, spawnHeight(-480)),
    flag: pt(4600, 200),
  });
}

/** Level 4: build speed, then ride the wall up and over onto the ceiling where the flag hangs. */
function upsideDown(): Level {
  const R = 100;
  const H = 60;
  const xw = 2500;
  const ceilingY = -(2 * R + H);
  const descent = join(
    line(-420, -1150, 120, -1150),
    curve(
      [120, -1150],
      [420, -1130],
      [760, -980],
      [1050, -760],
      [1300, -500],
      [1500, -260],
      [1680, -90],
      [1850, -10],
      [2000, 0],
    ),
    line(2000, 0, xw, 0),
  );
  const pipe = wallToCeiling({ xw, floorY: 0, radius: R, height: H, ceilingLength: 560 });
  return builtInLevel({
    id: 'builtin-4',
    name: 'Upside Down',
    difficulty: 'Medium',
    strokes: [stroke('l4-descent', descent), stroke('l4-pipe', pipe)],
    spawn: pt(60, spawnHeight(-1150)),
    flag: pt(xw - 420, ceilingY + 100),
  });
}

/** Level 5: downhill, three gaps, bumps, a steep landing, and a wall-and-ceiling finish. */
function inkMaster(): Level {
  const R = 100;
  const H = 60;
  const floorY = 1260;
  const xw = 7200;
  const ceilingY = floorY - (2 * R + H);
  const run = join(
    line(-420, -300, 100, -300),
    curve([100, -300], [400, -280], [700, -200], [1000, -90], [1250, -20], [1450, 0]),
    line(1450, 0, 1800, 0),
  );
  const bumps = join(
    curve([2200, 40], [2330, 70], [2450, 40], [2600, 90], [2760, 50], [2920, 110], [3050, 120]),
    line(3050, 120, 3300, 120),
  );
  const steep = join(
    curve([3600, 170], [3800, 300], [4000, 410], [4300, 480], [4600, 480]),
    line(4600, 480, 4900, 480),
  );
  const finale = join(
    curve([5460, 540], [5600, 680], [5800, 950], [6200, 1200], [6500, floorY - 20], [6650, floorY]),
    line(6650, floorY, xw, floorY),
  );
  const pipe = wallToCeiling({ xw, floorY, radius: R, height: H, ceilingLength: 560 });
  return builtInLevel({
    id: 'builtin-5',
    name: 'Ink Master',
    difficulty: 'Hard',
    strokes: [
      stroke('l5-run', run),
      stroke('l5-bumps', bumps),
      stroke('l5-steep', steep),
      stroke('l5-finale', finale),
      stroke('l5-pipe', pipe),
    ],
    spawn: pt(60, spawnHeight(-300)),
    flag: pt(xw - 420, ceilingY + 100),
  });
}

export const BUILT_IN_LEVELS: readonly Level[] = [
  firstRide(),
  firstJump(),
  airTime(),
  upsideDown(),
  inkMaster(),
];

export function getBuiltInLevel(id: string): Level | undefined {
  return BUILT_IN_LEVELS.find((l) => l.id === id);
}
