import { arc, builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level, Stroke, Vec2 } from './levelTypes';

/** World 4 "Blueprint" (Big Air & Speed): huge launches, half-pipes, long fast descents and wide landings. */

type Profile = (t: number) => number;
const smooth: Profile = (t) => t * t * (3 - 2 * t);
/** Starts steep and flattens out: matches a flyer coming down onto a landing. */
const flatten: Profile = (t) => 1 - (1 - t) * (1 - t);
/** Starts flat and steepens: a kicker. */
const steepen: Profile = (t) => t * t;

function sampled(x0: number, y0: number, dx: number, dy: number, f: Profile): Vec2[] {
  const n = Math.max(4, Math.ceil(Math.abs(dx) / 16));
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) pts.push(pt(x0 + (dx * i) / n, y0 + dy * f(i / n)));
  return pts;
}

/** Cursor-based builder: sections are appended left to right and x offsets are tracked for us. */
export class Course {
  x = 0;
  y = 0;
  /** Board x positions where the bot should release a jump (kicker lips, crest hops). */
  hops: number[] = [];
  private strokes: Stroke[] = [];
  private cur: Vec2[][] = [];
  private n = 0;
  private firstId: string | undefined;

  constructor(
    private prefix: string,
    start: { x: number; y: number },
    firstId?: string,
    startPts?: Vec2[],
  ) {
    this.x = start.x;
    this.y = start.y;
    this.firstId = firstId;
    if (startPts) this.cur.push(startPts);
  }

  private flush() {
    if (this.cur.length === 0) return;
    const id = this.firstId ?? `${this.prefix}${++this.n}`;
    this.firstId = undefined;
    this.strokes.push(stroke(id, join(...this.cur)));
    this.cur = [];
  }

  flat(len: number) {
    this.cur.push(line(this.x, this.y, this.x + len, this.y));
    this.x += len;
    return this;
  }

  /** Smooth S-shaped slope: eases in and out, so it joins flat ground with no bump. */
  slope(dx: number, dy: number) {
    this.cur.push(sampled(this.x, this.y, dx, dy, smooth));
    this.x += dx;
    this.y += dy;
    return this;
  }

  /** Smooth descent that starts steep (for landing) and ends flat. */
  landing(dx: number, dy: number) {
    this.cur.push(sampled(this.x, this.y, dx, dy, flatten));
    this.x += dx;
    this.y += dy;
    return this;
  }

  /** Quarter-parabola kicker that ends at its lip; the stroke ends there and a jump is planned. */
  kick(dx: number, rise: number, hop = true) {
    this.cur.push(sampled(this.x, this.y, dx, -rise, steepen));
    this.x += dx;
    this.y -= rise;
    if (hop) this.hops.push(this.x);
    this.flush();
    return this;
  }

  /** Ends the current stroke and moves the cursor across a gap (dy > 0 lands lower). */
  gap(w: number, dy: number) {
    this.flush();
    this.x += w;
    this.y += dy;
    return this;
  }

  /**
   * A concave bowl (circular arc). `rim`: the cursor is the left rim point. `lead`: the cursor is the
   * start of a straight lead-in line of length `lead` that runs down into the bowl.
   */
  bowl(args: { r: number; th0: number; th1: number; lead?: number; at?: 'rim' | 'lead' }) {
    const { r, th0, th1, lead = 0, at = 'rim' } = args;
    let sx = this.x;
    let sy = this.y;
    if (at === 'lead') {
      sx += Math.sin(th0) * lead;
      sy -= Math.cos(th0) * lead;
    }
    const cx = sx - Math.cos(th0) * r;
    const cy = sy - Math.sin(th0) * r;
    if (lead > 0) this.cur.push(line(sx - Math.sin(th0) * lead, sy + Math.cos(th0) * lead, sx, sy));
    this.cur.push(arc(cx, cy, r, th0, th1));
    this.x = cx + Math.cos(th1) * r;
    this.y = cy + Math.sin(th1) * r;
    return this;
  }

  /** Gentle long climb up to height `y` (slope stays under 0.2 so a cruising rider keeps moving). */
  climbTo(y: number, factor = 9) {
    const dy = y - this.y;
    if (dy < 0) this.slope(Math.max(1500, -dy * factor), dy);
    return this;
  }

  /** `n` rhythm gaps: a flat of `len`, a planned hop, then a gap of `w` (dy > 0 lands lower). */
  rhythm(n: number, len: number, w: number, dy = 0, hop = true) {
    for (let i = 0; i < n; i++) {
      this.flat(len);
      if (hop) this.hops.push(this.x);
      this.gap(w, dy);
    }
    return this;
  }

  /** `n` speed rhythm gaps: each a flat, a small 200 px lip of `rise` px, and a gap of `w` back to the flat's height. */
  lipRhythm(n: number, len: number, w: number, rise: number) {
    for (let i = 0; i < n; i++) {
      this.flat(len).kick(200, rise, false).gap(w, rise);
    }
    return this;
  }

  /** Extra planned jump at board x (crest hop). */
  hop(at: number) {
    this.hops.push(at);
    return this;
  }

  done(): Stroke[] {
    this.flush();
    return this.strokes;
  }
}

/** Launch Pad: a long fast descent into big kickers with wide, sloped landings, repeated down the mountain. */
function launchPad(): { level: Level; hops: number[] } {
  const inrun = join(
    line(-420, -520, 100, -520),
    curve([100, -520], [500, -480], [900, -380], [1400, -200], [1900, -80], [2300, -20]),
    curve([2300, -20], [2500, -20], [2700, -60], [2860, -130]),
  );
  const landing1 = join(
    curve([3100, -30], [3400, 60], [3800, 230], [4200, 360], [4600, 400], [4900, 400]),
    line(4900, 400, 5400, 400),
  );
  const kick2 = join(
    line(5400, 400, 5700, 400),
    curve([5700, 400], [5900, 400], [6080, 360], [6200, 290]),
  );
  const land2 = join(
    curve([6400, 380], [6800, 470], [7200, 540], [7600, 560]),
    line(7600, 560, 8300, 560),
  );
  const c = new Course('l20-', pt(8300, 560), 'l20-land2', land2);
  const baseY = 100;
  c.climbTo(baseY).flat(400).slope(800, 260).flat(250);
  c.kick(520, 130).gap(200, 90).landing(800, 300).flat(800);
  c.climbTo(baseY).flat(400).slope(900, 300).flat(250);
  c.kick(600, 150).gap(250, 110).landing(900, 360).flat(1400);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-20',
    name: 'Launch Pad',
    difficulty: 'Medium',
    strokes: [
      stroke('l20-inrun', inrun),
      stroke('l20-land1', landing1),
      stroke('l20-kick2', kick2),
      ...c.done(),
    ],
    spawn: pt(60, spawnHeight(-520)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: [2850, 6190, ...c.hops] };
}

type Plan = { level: Level; hops: number[] };

/** Bowls flown back to back (a half-pipe chain): each is reached across a gap that drops `drop` px. */
function pipeChain(c: Course, r: number, drop: number, w: number, count: number) {
  for (let i = 0; i < count; i++) {
    c.gap(w, drop).bowl({ r, th0: 2.5, th1: 0.9, lead: 300 });
  }
  return c;
}

function halfpipeHop(): Plan {
  const bowlAt = (cx: number, bottomY: number, lead = 0) => {
    const r = 450;
    const cy = bottomY - r;
    const th0 = 2.5;
    const sx = cx + Math.cos(th0) * r;
    const sy = cy + Math.sin(th0) * r;
    const pts = arc(cx, cy, r, th0, 0.9);
    return lead > 0
      ? join(line(sx - Math.sin(th0) * lead, sy + Math.cos(th0) * lead, sx, sy), pts)
      : pts;
  };
  const r1 = 450;
  const th = 2.4;
  const rimStart = pt(1500 + Math.cos(th) * r1, 0 - r1 + Math.sin(th) * r1);
  const lead = pt(rimStart.x - 0.675 * 700, rimStart.y - 0.737 * 700);
  const run = join(
    line(-420, lead.y, lead.x, lead.y),
    line(lead.x, lead.y, rimStart.x, rimStart.y),
    arc(1500, -r1, r1, th, 0.9),
  );
  const landing = join(
    curve([4560, 640], [4780, 800], [5100, 880], [5400, 900]),
    line(5400, 900, 5650, 900),
    curve([5650, 900], [5800, 900], [5920, 860], [6020, 790]),
  );
  const land2 = join(curve([6330, 830], [6550, 920], [6850, 950]), line(6850, 950, 7300, 950));
  const c = new Course('l21-', pt(7300, 950), 'l21-landing2', land2);
  const block = (r: number, drop: number, w: number, n: number, climbBack: number) => {
    c.climbTo(climbBack).flat(500);
    c.bowl({ r, th0: th, th1: 0.9, lead: 700, at: 'lead' });
    pipeChain(c, r, drop, w, n);
    c.gap(400, 18).landing(1100, 260).flat(800);
  };
  block(450, 290, 500, 2, 500);
  block(500, 320, 540, 3, 900);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-21',
    name: 'Halfpipe Hop',
    difficulty: 'Hard',
    strokes: [
      stroke('l21-run', run),
      stroke('l21-bowl2', bowlAt(2640, 370, 300)),
      stroke('l21-bowl3', bowlAt(3880, 720, 200)),
      stroke('l21-landing', landing),
      ...c.done(),
    ],
    spawn: pt(60, spawnHeight(lead.y)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: [] };
}

/** Sky Marathon (finale): the old draft run, then a second half that mixes every trick of the world. */
function skyMarathon(): Plan {
  const inrun = join(
    line(-420, -520, 100, -520),
    curve([100, -520], [500, -480], [900, -380], [1400, -200], [1900, -80], [2300, -20]),
    curve([2300, -20], [2500, -20], [2700, -60], [2860, -130]),
  );
  const hill1 = join(
    curve([3100, -30], [3400, 60], [3800, 230], [4200, 360], [4600, 400], [4900, 400]),
    line(4900, 400, 5000, 400),
    curve([5000, 400], [5300, 370], [5600, 260], [5800, 190]),
    line(5800, 190, 6250, 190),
  );
  const r2 = line(6400, 190, 6850, 190);
  const r3 = line(7020, 190, 7470, 190);
  const r4 = join(
    line(7660, 190, 8100, 190),
    curve([8100, 190], [8400, 260], [8800, 500], [9200, 720], [9500, 800]),
    line(9500, 800, 9900, 800),
    curve([9900, 800], [10100, 800], [10250, 760], [10360, 690]),
  );
  const hill2 = join(
    curve([11000, 1000], [11300, 1100], [11600, 1200], [11900, 1280]),
    line(11900, 1280, 12300, 1280),
    curve([12300, 1280], [12700, 1120], [13000, 990], [13250, 950]),
    line(13250, 950, 13560, 950),
  );
  const finish = join(
    curve([13840, 960], [14000, 980], [14300, 1060], [14600, 1130]),
    line(14600, 1130, 15000, 1130),
  );
  const c = new Course('l22-', pt(15000, 1130), 'l22-finish', finish);
  // Part 2: climb, rhythm gaps, a ski jump, a half-pipe chain, a launch chain and the grand finale gap.
  c.flat(700).rhythm(3, 450, 170, 60).flat(500);
  c.slope(700, 220).flat(250).kick(700, 200).gap(450, 200).landing(1100, 300).flat(900);
  c.climbTo(1000).flat(500).slope(1100, 450).flat(250);
  c.kick(500, 100).gap(250, 90).landing(900, 300).flat(600);
  c.climbTo(1000).flat(500).slope(1500, 650).flat(300);
  c.kick(800, 200).gap(500, 220).landing(1400, 450).flat(1600);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-22',
    name: 'Sky Marathon',
    difficulty: 'Expert',
    strokes: [
      stroke('l22-inrun', inrun),
      stroke('l22-hill1', hill1),
      stroke('l22-r2', r2),
      stroke('l22-r3', r3),
      stroke('l22-r4', r4),
      stroke('l22-hill2', hill2),
      ...c.done(),
    ],
    spawn: pt(60, spawnHeight(-520)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: [2850, 6250, 6850, 7470, 13560, ...c.hops] };
}

/** Ski Jump Chain: five ski jumps down a mountain, each bigger, each followed by a climb back up. */
function skiJumpChain(): Plan {
  const c = new Course('b37-', pt(-420, -400));
  c.flat(900);
  const jumps = [
    { down: 600, rise: 90, gap: 220, land: 300 },
    { down: 650, rise: 110, gap: 260, land: 300 },
    { down: 700, rise: 130, gap: 300, land: 300 },
  ];
  const baseY = c.y;
  for (const j of jumps) {
    c.slope(1500, j.down)
      .flat(250)
      .kick(Math.max(450, j.rise * 5), j.rise);
    c.gap(j.gap, 70).landing(1000, j.land - 70);
    c.flat(800).climbTo(baseY, 7).flat(500);
  }
  c.flat(900);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-37',
    name: 'Ski Jump Chain',
    difficulty: 'Medium',
    strokes: c.done(),
    spawn: pt(60, spawnHeight(baseY)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: [] };
}

/** Switchback Peak: a mountain descent whose slopes keep switching, with a crest launch on every climb. */
function switchbackPeak(): Plan {
  const c = new Course('b38-', pt(-420, -600));
  const startY = c.y;
  c.flat(900);
  for (let i = 1; i < 3; i++) {
    c.slope(1500 + i * 150, 350 + i * 40).flat(300);
    const up = 180 + i * 20;
    c.slope(Math.round(up * 8), -up).flat(150);
    c.slope(1300, 450 + i * 30).flat(250);
    c.kick(450, 80 + i * 15)
      .gap(220 + i * 30, 80)
      .landing(850, 220)
      .flat(650);
    c.climbTo(startY, 7).flat(500);
  }
  c.slope(1800, 300).flat(1400);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-38',
    name: 'Switchback Peak',
    difficulty: 'Hard',
    strokes: c.done(),
    spawn: pt(60, spawnHeight(startY)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: [] };
}

/** Redline Rhythm: huge descents to blistering speed, rhythm gaps taken at 1000+ px/s, long climbs to cool off. */
function redlineRhythm(): Plan {
  const c = new Course('b39-', pt(-420, -900));
  const baseY = c.y;
  c.flat(900);
  const rounds = [
    { drop: 600, n: 4, len: 500, w: 200, dy: 110 },
    { drop: 600, n: 4, len: 450, w: 260, dy: 140 },
    { drop: 600, n: 5, len: 400, w: 320, dy: 170 },
  ];
  for (const r of rounds) {
    c.slope(2600, r.drop).flat(300);
    c.rhythm(r.n, r.len, r.w, r.dy, false);
    c.landing(900, 120).flat(1200);
    c.climbTo(c.y - 600).flat(400);
  }
  c.flat(900);
  const flatEnd = c.x;
  const level = builtInLevel({
    id: 'builtin-39',
    name: 'Redline Rhythm',
    difficulty: 'Expert',
    strokes: c.done(),
    spawn: pt(60, spawnHeight(baseY)),
    flag: pt(flatEnd - 300, c.y),
  });
  return { level, hops: c.hops };
}

/** The six World 4 levels in play order, each with the bot's jump plan. */
export function blueprintPlans(): Plan[] {
  return [
    launchPad(),
    skiJumpChain(),
    halfpipeHop(),
    switchbackPeak(),
    redlineRhythm(),
    skyMarathon(),
  ];
}

export function blueprintLevels(): Level[] {
  return blueprintPlans().map((p) => p.level);
}
