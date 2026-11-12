import type { Simulation } from '../game/Simulation';
import { arc, builtInLevel, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level, Stroke, Vec2 } from './levelTypes';

/**
 * World 3 "Legal Pad": tight spaces and turnarounds. Levels are composed from small section helpers
 * (roofed hop corridors, duck-under slabs, stairs, dead-end hairpins, drops between tiers); each
 * helper also records the bot script that proves the section can be ridden.
 */

/** One autopilot step (mirrors the test bot's ScriptStep without importing test code). */
export interface LegalStep {
  until: (sim: Simulation) => boolean;
  flip?: boolean;
  crouch?: boolean;
}

export interface LegalPlan {
  level: Level;
  steps: LegalStep[];
}

const px = (sim: Simulation) => sim.skateboard.board.position.x;
const py = (sim: Simulation) => sim.skateboard.board.position.y;
const reach =
  (t: number, dir: 1 | -1 = 1) =>
  (sim: Simulation) =>
    dir > 0 ? px(sim) >= t : px(sim) <= t;
const never = () => false;

/** Dead-end wall (kept under the tier spacing so stacked tiers never touch) rising from the floor at (x, floorY); `side` 1 curves up on the +x side, -1 on the -x side. */
function deadEnd(x: number, floorY: number, side: 1 | -1, height = 140) {
  const R = 100;
  const cy = floorY - R;
  return join(
    side === 1 ? arc(x, cy, R, Math.PI / 2, 0) : arc(x, cy, R, Math.PI / 2, Math.PI),
    line(x + side * R, cy, x + side * R, cy - height),
  );
}

/** A staircase climbing in +x: `count` risers of `rise` px, each tread `tread` px long. */
function stairsPts(x: number, y: number, count: number, rise: number, tread: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const sx = x + i * tread;
    pts.push([sx, y - i * rise], [sx, y - (i + 1) * rise]);
  }
  const pieces: Vec2[][] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) pieces.push(line(a[0], a[1], b[0], b[1]));
  }
  return join(...pieces);
}

/** Composes a level left to right from sections; the cursor (x, y) sits on the current floor. */
class Builder {
  strokes: Stroke[] = [];
  steps: LegalStep[] = [];
  x = -420;
  y = 0;
  /** Left end of the floor under construction (where a return leg ends). */
  floorStart = -420;
  private pieces: Vec2[][] = [];
  private n = 0;

  constructor(private prefix: string) {}

  private add(pts: Vec2[], tag: string) {
    this.strokes.push(stroke(`${this.prefix}${tag}${this.n++}`, pts));
  }

  flush() {
    if (this.pieces.length) this.add(join(...this.pieces), 'f');
    this.pieces = [];
  }

  /** Open flat ground (good for manuals). */
  flat(len: number) {
    this.pieces.push(line(this.x, this.y, this.x + len, this.y));
    this.x += len;
    return this;
  }

  roof(x1: number, x2: number, off = 170) {
    this.add(line(x1, this.y - off, x2, this.y - off), 'r');
    return this;
  }

  /** A quick hop over a gap (needs a roof overhead to be a real gate). */
  hopGap(gap = 100) {
    const e = this.x;
    this.steps.push({ until: reach(e - 65) }, { crouch: true, until: reach(e - 45) });
    this.flush();
    this.x += Math.round(gap * 0.7);
    this.floorStart = this.x;
    return this;
  }

  /** A roofed corridor: flat, hop, flat, hop... under one low ceiling. */
  corridor(spacings: number[], gaps: number[] | number = 100, tail = 400) {
    const x0 = this.x;
    spacings.forEach((sp, i) => {
      this.flat(sp);
      this.hopGap(Array.isArray(gaps) ? (gaps[i] ?? 100) : gaps);
    });
    this.flat(tail);
    this.roof(x0 + (spacings[0] ?? 400) - 220, this.x - tail + 220);
    return this;
  }

  /** Duck under a low slab with the crouch held, then leap the gap at the end of the floor. */
  slabLeap(slab = 400, gap = 190, lead = 200) {
    const s0 = this.x;
    const slabStart = s0 + lead;
    const slabEnd = slabStart + slab;
    this.flat(lead + slab + 50);
    this.add(line(slabStart, this.y - 88, slabEnd, this.y - 88), 's');
    const e = this.x;
    this.steps.push({ until: reach(s0) }, { crouch: true, until: reach(e - 35) });
    this.flush();
    this.x += gap;
    this.floorStart = this.x;
    return this;
  }

  /** A long low roof over flat ground: ride straight through, no jumping. */
  tunnel(len: number) {
    const x0 = this.x;
    this.flat(len);
    this.roof(x0 + 80, x0 + len - 80);
    return this;
  }

  /** Crawl under a slab with the crouch held, release on open ground past its end. */
  crawl(slab = 500, lead = 200, tail = 400) {
    const s0 = this.x;
    const slabStart = s0 + lead;
    const slabEnd = slabStart + slab;
    this.flat(lead + slab + tail);
    this.add(line(slabStart, this.y - 88, slabEnd, this.y - 88), 's');
    this.steps.push({ until: reach(s0) }, { crouch: true, until: reach(slabEnd + 60) });
    return this;
  }

  /** A staircase up, hopping each riser. */
  stairs(count: number, rise = 90, tread = 450) {
    const x0 = this.x;
    for (let i = 0; i < count; i++) {
      const r = x0 + i * tread;
      this.steps.push({ until: reach(r - 260) }, { crouch: true, until: reach(r - 130) });
    }
    this.pieces.push(stairsPts(x0, this.y, count, rise, tread));
    this.x = x0 + (count - 1) * tread;
    this.y -= count * rise;
    return this;
  }

  /** Fall off the end of this floor onto a new floor `drop` px lower (extends back under the ledge). */
  dropForward(drop = 300) {
    const e = this.x;
    this.flush();
    this.y += drop;
    this.pieces.push(line(e - 300, this.y, e, this.y));
    this.floorStart = e - 300;
    const yy = this.y;
    this.steps.push({ until: (s) => s.grounded && py(s) > yy - 70 && px(s) > e + 60 });
    return this;
  }

  /**
   * Dead end then a hairpin: turn at the wall, ride back to the left edge, drop, ride left to a
   * second wall, turn again and continue right on the lower tier.
   */
  hairpin(drop = 300, back = 700) {
    const wall = this.x;
    const xa = this.floorStart;
    const yA = this.y;
    this.pieces.push(deadEnd(wall, yA, 1));
    this.flush();
    const yB = yA + drop;
    this.steps.push(
      { until: reach(wall - 110) },
      {
        flip: true,
        until: (s) => s.grounded && py(s) > yB - 70 && px(s) < xa,
      },
    );
    const xb = xa - back;
    this.pieces.push(deadEnd(xb, yB, -1).reverse());
    this.y = yB;
    this.x = xb;
    this.floorStart = xb;
    this.steps.push({ until: reach(xb + 110, -1) }, { flip: true, until: reach(xb + 320) });
    return this;
  }

  /** Last dead end: turn and ride back along this floor; returns the flag position. */
  finalTurn(flagBack = 800) {
    const wall = this.x;
    this.pieces.push(deadEnd(wall, this.y, 1));
    this.flush();
    this.steps.push({ until: reach(wall - 110) }, { flip: true, until: never });
    return pt(wall - flagBack, this.y);
  }

  /** Last open stretch and flag, no turn. */
  finish(len = 600) {
    this.flat(len);
    this.flush();
    this.steps.push({ until: never });
    return pt(this.x - 250, this.y);
  }
}

function make(
  id: string,
  name: string,
  difficulty: string,
  prefix: string,
  build: (b: Builder) => Vec2,
): LegalPlan {
  const b = new Builder(prefix);
  b.floorStart = b.x;
  const flag = build(b);
  b.flush();
  return {
    level: builtInLevel({
      id,
      name,
      difficulty,
      strokes: b.strokes,
      spawn: pt(60, spawnHeight(0)),
      flag,
    }),
    steps: b.steps,
  };
}

/** Margin Walk: a gentle intro. Open flats, roofed hops, a duck-under, then two hairpins. */
function marginWalk(): LegalPlan {
  return make('builtin-32', 'Margin Walk', 'Medium', 'lg32-', (b) => {
    b.flat(1500);
    b.tunnel(1200);
    b.flat(300);
    b.corridor([500, 500, 500], 100, 500);
    b.flat(900);
    b.slabLeap(400);
    b.flat(900);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 800);
    b.flat(900);
    b.corridor([500, 550], 100, 400);
    b.flat(1000);
    b.dropForward();
    b.flat(1000);
    b.crawl(450);
    b.flat(1000);
    return b.finalTurn(1000);
  });
}

/** Staple Alley: stairs up, then long low corridors of uneven hops. */
function stapleAlley(): LegalPlan {
  return make('builtin-33', 'Staple Alley', 'Medium', 'lg33-', (b) => {
    b.flat(1100);
    b.stairs(3);
    b.flat(900);
    b.corridor([380, 560, 420, 600, 450], [100, 90, 110, 100, 95], 500);
    b.flat(800);
    b.dropForward();
    b.flat(1000);
    b.corridor([450, 450, 520], 105, 400);
    b.flat(900);
    b.stairs(2, 90, 500);
    b.flat(800);
    b.tunnel(1000);
    b.flat(300);
    b.dropForward();
    b.flat(900);
    b.hairpin(300, 700);
    b.flat(900);
    b.corridor([500, 450, 500], 100, 400);
    b.flat(1100);
    return b.finalTurn(900);
  });
}

/** Paper Clip: three stacked hairpins separated by long open runs. */
function paperClip(): LegalPlan {
  return make('builtin-34', 'Paper Clip', 'Hard', 'lg34-', (b) => {
    b.flat(1300);
    b.dropForward();
    b.flat(1300);
    b.hairpin(300, 800);
    b.flat(1500);
    b.dropForward();
    b.flat(1200);
    b.hairpin(300, 700);
    b.flat(1500);
    b.dropForward();
    b.flat(1200);
    b.hairpin(300, 800);
    b.flat(1400);
    b.corridor([500, 500], 100, 400);
    b.flat(900);
    b.dropForward();
    b.flat(1000);
    return b.finalTurn(1000);
  });
}

/** Fine Print: duck-under slabs of growing length, linked by hops and hairpins. */
function finePrint(): LegalPlan {
  return make('builtin-35', 'Fine Print', 'Hard', 'lg35-', (b) => {
    b.flat(1000);
    b.slabLeap(300);
    b.flat(800);
    b.corridor([450, 450], 100, 300);
    b.slabLeap(450);
    b.flat(900);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 700);
    b.flat(700);
    b.corridor([420, 500, 420], 105, 300);
    b.slabLeap(550);
    b.flat(1100);
    b.crawl(550);
    b.flat(700);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 800);
    b.flat(800);
    b.slabLeap(500, 200);
    b.flat(800);
    b.corridor([450, 450, 450], 100, 300);
    b.flat(1000);
    b.dropForward();
    b.flat(900);
    return b.finalTurn(900);
  });
}

/** Binder Rings: stairs up, then a spiral down through several tiers. */
function binderRings(): LegalPlan {
  return make('builtin-36', 'Binder Rings', 'Hard', 'lg36-', (b) => {
    b.flat(900);
    b.stairs(2);
    b.flat(800);
    b.corridor([500, 450, 500], 100, 400);
    b.flat(800);
    b.stairs(3, 80, 500);
    b.flat(1000);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 700);
    b.flat(700);
    b.slabLeap(400);
    b.flat(800);
    b.dropForward();
    b.flat(1100);
    b.hairpin(300, 800);
    b.flat(1000);
    b.tunnel(1100);
    b.flat(300);
    b.corridor([450, 500, 450, 500], [100, 105, 100, 95], 400);
    b.flat(900);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 800);
    b.flat(900);
    b.crawl(500);
    b.flat(1000);
    b.dropForward();
    b.flat(1000);
    return b.finalTurn(900);
  });
}

/** Long Tunnel (finale): the Gauntlet twice over, five tiers deep, with four turn-arounds. */
function longTunnel(): LegalPlan {
  return make('builtin-19', 'Long Tunnel', 'Expert', 'l19-', (b) => {
    b.flat(1020);
    b.stairs(2);
    b.flat(650);
    b.corridor([600, 560, 500], [100, 100, 105], 300);
    b.flat(500);
    b.slabLeap(350);
    b.flat(1000);
    b.dropForward();
    b.flat(1100);
    b.hairpin(300, 800);
    b.flat(1000);
    b.corridor([600, 500, 500, 600, 500], [100, 110, 100, 105, 100], 300);
    b.slabLeap(400);
    b.flat(900);
    b.dropForward();
    b.flat(900);
    b.hairpin(300, 800);
    b.flat(1000);
    b.tunnel(1200);
    b.flat(300);
    b.corridor([500, 450, 550], 100, 300);
    b.slabLeap(450);
    b.flat(900);
    b.dropForward();
    b.flat(1000);
    b.hairpin(300, 900);
    b.flat(1000);
    b.crawl(500);
    b.flat(1300);
    return b.finalTurn(900);
  });
}

/** The six World 3 levels with their bot scripts, easiest first, finale last. */
export function legalPlans(): LegalPlan[] {
  return [marginWalk(), stapleAlley(), paperClip(), finePrint(), binderRings(), longTunnel()];
}

export function legalLevels(): Level[] {
  return legalPlans().map((p) => p.level);
}
