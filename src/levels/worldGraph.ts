import { builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level, Vec2 } from './levelTypes';

/**
 * World 2, "Graph Paper" (Gaps & Jumps): six long levels built from small section generators.
 * Coordinates: y grows downward, the travel direction is +x.
 */

/** A planned bot jump: release the crouch at board x = `at` after charging `charge` seconds. */
export interface GraphJump {
  at: number;
  charge: number;
}

/** A built level plus the bot plan that clears it and where each jump lands (for tests and tuning). */
export interface GraphCourse {
  level: Level;
  jumps: GraphJump[];
  /** x of the first ground after each gap, in the same order as `jumps`. */
  lands: number[];
}

const DEFAULT_CHARGE = 0.2;

/** Walks a cursor along the course laying platforms, slopes and gaps; each gap adds a bot jump. */
class Course {
  x: number;
  y: number;
  private pieces: Vec2[][] = [];
  private strokes: Vec2[][] = [];
  readonly ats: number[] = [];
  readonly lands: number[] = [];

  constructor(
    x: number,
    y: number,
    private readonly charges: readonly number[],
  ) {
    this.x = x;
    this.y = y;
  }

  /** Straight ground. */
  run(len: number, dy = 0): this {
    this.pieces.push(line(this.x, this.y, this.x + len, this.y + dy));
    this.x += len;
    this.y += dy;
    return this;
  }

  /** Smooth ground that is level at both ends (an S-curve), for slopes without kinks. */
  ease(len: number, dy: number): this {
    this.pieces.push(
      curve(
        [this.x, this.y],
        [this.x + len * 0.3, this.y + dy * 0.14],
        [this.x + len * 0.7, this.y + dy * 0.86],
        [this.x + len, this.y + dy],
      ),
    );
    this.x += len;
    this.y += dy;
    return this;
  }

  /** Near-straight slope with softened ends: the way to climb (keep dy/len under about 0.28 or the rider stalls). */
  ramp(len: number, dy: number): this {
    this.pieces.push(
      curve(
        [this.x, this.y],
        [this.x + len * 0.15, this.y + dy * 0.05],
        [this.x + len * 0.85, this.y + dy * 0.95],
        [this.x + len, this.y + dy],
      ),
    );
    this.x += len;
    this.y += dy;
    return this;
  }

  /** A V-shaped dip: down `depth` px, flat for `bottom`, then a gentle climb back to the starting height. */
  dip(depth: number, down: number, bottom: number): this {
    return this.ramp(down, depth)
      .run(bottom)
      .ramp(Math.round(depth * 4.4), -depth);
  }

  /** Gently rolling ground: a shallow bump of `amp` px riding on a straight `dy` slope. */
  swell(len: number, dy: number, amp: number): this {
    this.pieces.push(
      curve(
        [this.x, this.y],
        [this.x + len * 0.25, this.y + dy * 0.25 - amp],
        [this.x + len * 0.5, this.y + dy * 0.5],
        [this.x + len * 0.75, this.y + dy * 0.75 + amp],
        [this.x + len, this.y + dy],
      ),
    );
    this.x += len;
    this.y += dy;
    return this;
  }

  /** Ends the platform (optionally with a 160 px launch lip rising `lip` px), leaves a gap of `width`, and drops `dy`. */
  gap(width: number, dy = 0, lip = 0): this {
    if (lip > 0) {
      this.pieces.push(
        curve([this.x, this.y], [this.x + 80, this.y - lip * 0.25], [this.x + 160, this.y - lip]),
      );
      this.x += 160;
      this.y -= lip;
    }
    this.flush();
    this.ats.push(this.x - 30);
    this.x += width;
    this.y += dy;
    this.lands.push(this.x);
    return this;
  }

  /** `n` equal platforms of `platLen`, each followed by a gap of `gapW` (the last gap is included). */
  rhythm(n: number, platLen: number, gapW: number, dy = 0, lip = 0): this {
    for (let i = 0; i < n; i++) this.run(platLen, dy).gap(gapW, 0, lip);
    return this;
  }

  private flush(): void {
    if (this.pieces.length > 0) this.strokes.push(join(...this.pieces));
    this.pieces = [];
  }

  /** Closes the current platform and returns every stroke laid so far. */
  done(): Vec2[][] {
    this.flush();
    return this.strokes;
  }

  plan(): GraphJump[] {
    return this.ats.map((at, i) => ({ at, charge: this.charges[i] ?? DEFAULT_CHARGE }));
  }
}

function assemble(
  id: string,
  prefix: string,
  name: string,
  difficulty: NonNullable<Level['difficulty']>,
  c: Course,
  startY: number,
  extra: Vec2[][] = [],
): GraphCourse {
  const all = [...extra, ...c.done()];
  return {
    level: builtInLevel({
      id,
      name,
      difficulty,
      strokes: all.map((pts, i) => stroke(`${prefix}${i}`, pts)),
      spawn: pt(60, spawnHeight(startY)),
      flag: pt(c.x - 420, c.y),
    }),
    jumps: c.plan(),
    lands: c.lands,
  };
}

/** builtin-17: separate platforms; the gaps widen, the platforms slope down to feed speed, then it climbs and repeats. */
function steppingStones(ch: readonly number[]): GraphCourse {
  const c = new Course(-420, 0, ch);
  // Flight one: the original widening ladder, gaps 160 -> 380.
  c.run(1120).gap(160, 30);
  c.run(540, 30).gap(200, 30);
  c.run(560, 60).gap(240, 30);
  c.run(560, 90).gap(290, 60);
  c.run(600, 100).gap(340, 70);
  c.run(650, 110).gap(380, 80);
  // A long slow stretch for manuals, climbing back up.
  c.run(350, 50).ramp(900, -230).run(500);
  // Flight two: flat stones, gaps widening gently.
  c.gap(190, 10).run(600, 10);
  c.gap(205, 10).run(600, 10);
  c.gap(220, 10).run(620, 10);
  c.gap(230, 10).run(650, 10);
  c.gap(235, 10).run(700);
  return assemble('builtin-17', 'l17-', 'Stepping Stones', 'Medium', c, 0);
}

/** builtin-28: rule-straight rhythm sections, every gap the same width within a set, with long flats between. */
function rulerMarks(ch: readonly number[]): GraphCourse {
  const c = new Course(-420, 0, ch);
  c.run(1100);
  c.rhythm(4, 600, 170);
  c.run(400);
  c.rhythm(4, 600, 190);
  c.run(300).swell(600, 0, 14).run(300);
  c.rhythm(3, 650, 205, 14);
  c.run(700);
  return assemble('builtin-28', 'g28-', 'Ruler Marks', 'Medium', c, 0);
}

/** builtin-30: long manual-friendly flats alternate with tight clusters of three gaps. */
function ledgerLines(ch: readonly number[]): GraphCourse {
  const c = new Course(-420, 0, ch);
  c.run(1100);
  // Cluster one.
  c.rhythm(3, 600, 190, 6);
  c.run(400).swell(700, 20, 16).run(300);
  // Cluster two: widening.
  c.gap(170, 20).run(600).gap(190, 20).run(600).gap(210, 20);
  c.run(500);
  // Cluster three: drops, then a long climb back.
  c.gap(200, 60).run(650).gap(220, 60).run(650).gap(240, 60);
  c.run(300).ramp(1000, -210).run(400);
  // Cluster four: tight equal.
  c.rhythm(3, 600, 215);
  c.run(300).swell(800, -40, 20).run(500);
  return assemble('builtin-30', 'g30-', 'Ledger Lines', 'Hard', c, 0);
}

/** builtin-29: each lipped launch lands on a steep downslope; the shelves step back up between drops. */
function cliffNotes(ch: readonly number[]): GraphCourse {
  const c = new Course(-420, 0, ch);
  c.run(1100);
  for (let i = 0; i < 5; i++) {
    // A ledge drop onto a steep face that eases out flat, then a bowl-shaped dip and a long gentle climb back.
    const face = 150 + i * 15;
    c.gap(190 + i * 7, 60 + i * 10)
      .ease(360 + i * 40, face)
      .run(350);
    c.ramp(Math.round((face + 60 + i * 10) * 4.6), -(face + 60 + i * 10)).run(350);
    c.swell(600, 0, 12).run(250);
  }
  c.gap(215, 100).ease(600, 200).run(700);
  return assemble('builtin-29', 'g29-', 'Cliff Notes', 'Hard', c, 0);
}

/** builtin-31: down-then-up canyons; speed from the descent carries long jumps across the bottom. */
function axisCrossing(ch: readonly number[]): GraphCourse {
  const c = new Course(-420, 0, ch);
  c.run(1100);
  for (let i = 0; i < 5; i++) {
    // A deep V-shaped canyon, then a rim-to-rim jump back on level ground.
    c.dip(220 + i * 30, 700 + i * 60, 260).run(400);
    c.gap(200 + i * 8, 40 + i * 10).run(600);
    c.swell(480, 0, 12).run(250);
  }
  c.run(700);
  return assemble('builtin-31', 'g31-', 'Axis Crossing', 'Hard', c, 0);
}

/** builtin-18: the finale. The original canyon course, then three more canyons, rhythm sections and a closing flat. */
function canyonRun(ch: readonly number[]): GraphCourse {
  const s1 = join(
    line(-420, -500, 200, -500),
    curve([200, -500], [600, -420], [1000, -200], [1400, -20], [1700, 0]),
    line(1700, 0, 1900, 0),
  );
  const s2 = join(
    line(2300, 60, 2700, 60),
    curve([2700, 60], [3100, 150], [3500, 300]),
    line(3500, 300, 3720, 300),
    curve([3720, 300], [3860, 292], [3980, 240]),
  );
  const s3 = join(
    curve([4500, 330], [4800, 300], [5100, 160], [5300, 100]),
    line(5300, 100, 5700, 100),
  );
  const rhythm1 = [
    line(5820, 100, 6070, 100),
    line(6190, 100, 6440, 100),
    line(6560, 100, 6810, 100),
    line(6930, 100, 7180, 100),
  ];
  const s4 = join(
    curve([7300, 100], [7700, 70], [8100, 10]),
    line(8100, 10, 8200, 10),
    curve([8200, 10], [8500, 100], [8750, 200]),
    line(8750, 200, 8850, 205),
  );
  const s5 = join(curve([9130, 320], [9300, 350], [9520, 350]), line(9520, 350, 10000, 350));
  const rhythm2 = [
    line(10140, 350, 10390, 350),
    line(10530, 350, 10780, 350),
    line(10920, 350, 11170, 350),
  ];
  const head = [s1, s2, s3, ...rhythm1, s4, s5, ...rhythm2];
  // The original course keeps its jump marks; the tail below adds more.
  const headAts = [1892, 3972, 5692, 6062, 6432, 6802, 7172, 8842, 9992, 10382, 10772, 11162];
  const headLands = [2300, 4500, 5820, 6190, 6560, 6930, 7300, 9130, 10140, 10530, 10920, 11310];
  const c = new Course(11310, 350, ch.slice(headAts.length));
  c.run(600);
  // Three more canyons, each with a deeper plunge and a wider crossing.
  for (let i = 0; i < 3; i++) {
    const depth = 250 + i * 50;
    c.ramp(700 + i * 100, depth).run(240);
    c.gap(330 + i * 50, 0)
      .ramp(Math.round(depth * 4.4), -depth)
      .run(360);
    c.rhythm(3, 260 + i * 30, 130 + i * 25);
    if (i < 2) c.run(250).swell(700, 0, 14).run(200);
  }
  c.run(600);
  const base = assemble('builtin-18', 'l18-', 'Canyon Run', 'Expert', c, -500, head);
  const jumps = [...headAts.map((at, i) => ({ at, charge: ch[i] ?? 0.05 })), ...c.plan()];
  return { level: base.level, jumps, lands: [...headLands, ...c.lands] };
}

/** Tuned bot charges (seconds of crouch) per level, in jump order. */
const CHARGES: Record<string, number[]> = {
  'builtin-17': [
    0.15, 0.25, 0.3, 0.3, 0.4, 0.6, 0.3, 0.35, 0.35, 0.35, 0.45, 0.45, 0.5, 0.5, 0.5, 0.35, 0.45,
    0.5, 0.5,
  ],
  'builtin-28': [
    0.25, 0.25, 0.25, 0.2, 0.25, 0.3, 0.35, 0.3, 0.3, 0.35, 0.25, 0.3, 0.3, 0.3, 0.35, 0.35, 0.35,
    0.4, 0.5,
  ],
  'builtin-30': [0.25, 0.3, 0.3, 0.15, 0.25, 0.3, 0.15, 0.3, 0.4, 0.4, 0.45, 0.4, 0.4, 0.45, 0.45],
  'builtin-29': [0.2, 0.2, 0.2, 0.25, 0.25, 0.25],
  'builtin-31': [0.3, 0.3, 0.3, 0.35, 0.35],
  'builtin-18': [
    0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.1, 0.2, 0.2, 0.2,
    0.2, 0.2, 0.25, 0.2, 0.25, 0.35, 0.35, 0.25, 0.2, 0.45, 0.4,
  ],
};

const BUILDERS: [string, (ch: readonly number[]) => GraphCourse][] = [
  ['builtin-17', steppingStones],
  ['builtin-28', rulerMarks],
  ['builtin-30', ledgerLines],
  ['builtin-29', cliffNotes],
  ['builtin-31', axisCrossing],
  ['builtin-18', canyonRun],
];

/** The six courses (level, bot plan, landing marks) in play order, optionally with charge overrides. */
export function graphCourses(overrides: Record<string, number[]> = {}): GraphCourse[] {
  return BUILDERS.map(([id, build]) => build(overrides[id] ?? CHARGES[id] ?? []));
}

/** One course by level id, optionally with a charge override. */
export function graphCourse(id: string, charges?: number[]): GraphCourse {
  const entry = BUILDERS.find(([key]) => key === id);
  if (!entry) throw new Error(`unknown level ${id}`);
  return entry[1](charges ?? CHARGES[id] ?? []);
}

/** World 2 levels in play order, easiest first, finale last. */
export function graphLevels(): Level[] {
  return graphCourses().map((c) => c.level);
}
