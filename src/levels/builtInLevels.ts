import { arc, builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level } from './levelTypes';
import { NEW_LEVELS } from './newLevels';
import { OBJECTIVE_TARGETS } from './objectiveTargets';
import { WORLDS } from './worlds';

/**
 * Hand-built courses. They use exactly the same stroke format as custom levels.
 * Coordinates: y grows downward, the travel direction is +x.
 */

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

/** Level 5: downhill, three gaps, bumps, and a steep landing before the flag. */
function inkMaster(): Level {
  const floorY = 1260;
  const xw = 7200;
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
  return builtInLevel({
    id: 'builtin-5',
    name: 'Ink Master',
    difficulty: 'Hard',
    strokes: [
      stroke('l5-run', run),
      stroke('l5-bumps', bumps),
      stroke('l5-steep', steep),
      stroke('l5-finale', finale),
    ],
    spawn: pt(60, spawnHeight(-300)),
    flag: pt(xw - 420, floorY),
  });
}

/** Dead-end wall rising from the floor at (x, floorY); `side` 1 curves up on the +x side, -1 on the -x side. */
function deadEnd(args: { x: number; floorY: number; side: 1 | -1; height: number }) {
  const { x, floorY, side, height } = args;
  const R = 100;
  const cx = x;
  const cy = floorY - R;
  return join(
    side === 1 ? arc(cx, cy, R, Math.PI / 2, 0) : arc(cx, cy, R, Math.PI / 2, Math.PI),
    line(x + side * R, cy, x + side * R, cy - height),
  );
}

/** Level 7: drop down two ledges; each one dead-ends, so you have to turn around to reach the next drop. */
function switchback(): Level {
  const top = line(-420, 0, 1500, 0);
  const middle = join(
    line(300, 300, 1900, 300),
    deadEnd({ x: 1900, floorY: 300, side: 1, height: 260 }),
  );
  const bottom = join(
    deadEnd({ x: -500, floorY: 600, side: -1, height: 260 }).reverse(),
    line(-500, 600, 1100, 600),
  );
  return builtInLevel({
    id: 'builtin-7',
    name: 'Switchback',
    difficulty: 'Hard',
    strokes: [stroke('l7-top', top), stroke('l7-middle', middle), stroke('l7-bottom', bottom)],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(900, 600),
  });
}

/** Level 8: a four-tier zigzag with a gap to clear on the way back, and a flag that needs one last turn. */
function zigzag(): Level {
  const a = line(-420, 0, 1300, 0);
  const b = join(
    line(100, 260, 1700, 260),
    deadEnd({ x: 1700, floorY: 260, side: 1, height: 240 }),
  );
  const c1 = join(
    deadEnd({ x: -700, floorY: 520, side: -1, height: 240 }).reverse(),
    line(-700, 520, 300, 520),
  );
  const c2 = line(500, 520, 900, 520);
  const d = join(
    line(500, 780, 2300, 780),
    deadEnd({ x: 2300, floorY: 780, side: 1, height: 240 }),
  );
  return builtInLevel({
    id: 'builtin-8',
    name: 'Zigzag',
    difficulty: 'Expert',
    strokes: [
      stroke('l8-a', a),
      stroke('l8-b', b),
      stroke('l8-c1', c1),
      stroke('l8-c2', c2),
      stroke('l8-d', d),
    ],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(700, 780),
  });
}

/** A staircase climbing in +x: `count` risers of `rise` px, each tread `tread` px long. */
function stairs(args: { x: number; y: number; count: number; rise: number; tread: number }) {
  const { x, y, count, rise, tread } = args;
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const sx = x + i * tread;
    pts.push([sx, y - i * rise], [sx, y - (i + 1) * rise]);
  }
  const pieces = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) pieces.push(line(a[0], a[1], b[0], b[1]));
  }
  return join(...pieces);
}

/** Level 9: jump up a flight of steps. A missed step just stops you; back up and try again. */
function stairway(): Level {
  const ground = join(
    line(-420, 0, 700, 0),
    stairs({ x: 700, y: 0, count: 4, rise: 90, tread: 450 }),
    line(700 + 3 * 450, -360, 3200, -360),
  );
  return builtInLevel({
    id: 'builtin-9',
    name: 'Stairway',
    difficulty: 'Easy',
    strokes: [stroke('l9-stairs', ground)],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(2900, -360),
  });
}

/** Level 10: a ski jump. Long flight onto a steep landing hill; tilt to meet the slope. */
function skiJump(): Level {
  const inrun = join(
    line(-420, -900, 100, -900),
    curve(
      [100, -900],
      [450, -820],
      [800, -560],
      [1100, -330],
      [1260, -250],
      [1340, -250],
      [1420, -290],
    ),
  );
  const hill = join(
    curve(
      [1380, -150],
      [1650, -100],
      [1900, 10],
      [2200, 240],
      [2500, 470],
      [2800, 640],
      [3100, 720],
      [3400, 740],
    ),
    line(3400, 740, 4300, 740),
  );
  return builtInLevel({
    id: 'builtin-10',
    name: 'Ski Jump',
    difficulty: 'Medium',
    strokes: [stroke('l10-inrun', inrun), stroke('l10-hill', hill)],
    spawn: pt(60, spawnHeight(-900)),
    flag: pt(4000, 740),
  });
}

/** Level 11: hop small gaps under a tunnel roof, then duck under a slab and leap as you come out. */
function lowCeiling(): Level {
  const a = line(-420, 0, 1100, 0);
  const b = line(1200, 0, 1700, 0);
  const c = line(1810, 0, 2600, 0);
  const d = line(2790, 0, 3700, 0);
  const roof = line(500, -170, 1950, -170);
  const slab = line(2150, -88, 2550, -88);
  return builtInLevel({
    id: 'builtin-11',
    name: 'Low Ceiling',
    difficulty: 'Medium',
    strokes: [
      stroke('l11-a', a),
      stroke('l11-b', b),
      stroke('l11-c', c),
      stroke('l11-d', d),
      stroke('l11-roof', roof),
      stroke('l11-slab', slab),
    ],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(3400, 0),
  });
}

/** Level 12: a long descent split by ever wider gaps; you keep gaining speed, so every jump comes faster. */
function downhillRush(): Level {
  const slope = 0.25;
  const y = (x: number) => (x - 300) * slope;
  const piece = (x0: number, x1: number) => line(x0, y(x0), x1, y(x1));
  const s1 = join(line(-420, 0, 300, 0), piece(300, 1300));
  const s5 = join(
    piece(4650, 5000),
    curve([5000, y(5000)], [5250, y(5000) + 50], [5500, y(5000) + 70]),
    line(5500, y(5000) + 70, 6400, y(5000) + 70),
  );
  return builtInLevel({
    id: 'builtin-12',
    name: 'Downhill Rush',
    difficulty: 'Hard',
    strokes: [
      stroke('l12-1', s1),
      stroke('l12-2', piece(1550, 2100)),
      stroke('l12-3', piece(2500, 3000)),
      stroke('l12-4', piece(3500, 4100)),
      stroke('l12-5', s5),
    ],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(6100, y(5000) + 70),
  });
}

/** Level 13: steps, a roofed hop, a duck-and-leap, then a drop onto a dead end and a turn to the flag. */
function gauntlet(): Level {
  const top = -180;
  const climb = join(
    line(-420, 0, 600, 0),
    stairs({ x: 600, y: 0, count: 2, rise: 90, tread: 450 }),
    line(1050, top, 1700, top),
  );
  const mid = line(1800, top, 2950, top);
  const roof = line(1300, top - 170, 2300, top - 170);
  const slab = line(2550, top - 88, 2900, top - 88);
  const ledge = line(3140, top, 4200, top);
  const floor = join(
    line(3400, 120, 4600, 120),
    deadEnd({ x: 4600, floorY: 120, side: 1, height: 240 }),
  );
  return builtInLevel({
    id: 'builtin-13',
    name: 'Gauntlet',
    difficulty: 'Expert',
    strokes: [
      stroke('l13-climb', climb),
      stroke('l13-mid', mid),
      stroke('l13-roof', roof),
      stroke('l13-slab', slab),
      stroke('l13-ledge', ledge),
      stroke('l13-floor', floor),
    ],
    spawn: pt(60, spawnHeight(0)),
    flag: pt(3650, 120),
  });
}

/** Level 14: a kicker lip throws the nose up; tilt down in flight to meet the steep landing slope. */
function noseDive(): Level {
  const inrun = join(
    line(-420, -700, 100, -700),
    curve([100, -700], [450, -640], [800, -400], [1050, -230], [1250, -170]),
    curve([1250, -170], [1350, -170], [1450, -215], [1520, -290]),
  );
  const slope = join(
    curve([1780, -60], [1900, 30], [2050, 280], [2200, 550], [2350, 800]),
    curve([2350, 800], [2500, 900], [2700, 920]),
    line(2700, 920, 4200, 920),
  );
  return builtInLevel({
    id: 'builtin-14',
    name: 'Nose Dive',
    difficulty: 'Hard',
    strokes: [stroke('l14-inrun', inrun), stroke('l14-slope', slope)],
    spawn: pt(60, spawnHeight(-700)),
    flag: pt(3700, 920),
  });
}

/** Level 15: two ski jumps back to back; the first landing sets the speed and attitude for the second lip. */
function doubleDive(): Level {
  const inrun = join(
    line(-420, -700, 100, -700),
    curve([100, -700], [450, -640], [800, -400], [1050, -230], [1250, -170]),
    curve([1250, -170], [1350, -170], [1450, -215], [1520, -290]),
  );
  const valley = join(
    curve([1780, -60], [1900, 30], [2050, 280], [2200, 520], [2350, 680]),
    curve([2350, 680], [2500, 760], [2650, 740], [2800, 680], [2900, 600]),
  );
  const landing = join(
    curve([3150, 540], [3300, 620], [3450, 900], [3600, 1150]),
    curve([3600, 1150], [3750, 1250], [4100, 1270]),
    line(4100, 1270, 5000, 1270),
  );
  return builtInLevel({
    id: 'builtin-15',
    name: 'Double Dive',
    difficulty: 'Expert',
    strokes: [
      stroke('l15-inrun', inrun),
      stroke('l15-valley', valley),
      stroke('l15-landing', landing),
    ],
    spawn: pt(60, spawnHeight(-700)),
    flag: pt(4700, 1270),
  });
}

/** Every built-in level by id, before worlds decide the play order. */
const ALL_LEVELS: readonly Level[] = [
  firstRide(),
  firstJump(),
  stairway(),
  airTime(),
  skiJump(),
  lowCeiling(),
  inkMaster(),
  switchback(),
  downhillRush(),
  noseDive(),
  zigzag(),
  gauntlet(),
  doubleDive(),
  ...NEW_LEVELS,
];

/** Built-in levels in play order: world by world. Each level knows its world and its objectives. */
export const BUILT_IN_LEVELS: readonly Level[] = WORLDS.flatMap((world) =>
  world.levelIds.flatMap((id) => {
    const level = ALL_LEVELS.find((l) => l.id === id);
    if (!level) return [];
    const objectives = OBJECTIVE_TARGETS[id];
    return [{ ...level, worldId: world.id, ...(objectives ? { objectives } : {}) }];
  }),
);

export function getBuiltInLevel(id: string): Level | undefined {
  return BUILT_IN_LEVELS.find((l) => l.id === id);
}
