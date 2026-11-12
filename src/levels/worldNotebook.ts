import { builtInLevel, curve, join, line, pt, spawnHeight, stroke } from './levelFactory';
import type { Level, Stroke, Vec2 } from './levelTypes';

/**
 * World 1, "Notebook" (lined paper, "Learn to Roll"): levels 23-27.
 * Coordinates: y grows downward, the travel direction is +x.
 * Levels are composed from small sections by a cursor-based builder so x offsets are computed.
 */

/** A planned hop for the test bot: release the crouch at board x = `at`. */
export interface NotebookJump {
  at: number;
  charge: number;
}

export interface NotebookCourse {
  level: Level;
  jumps: NotebookJump[];
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

class Builder {
  x = -420;
  y = 0;
  strokes: Stroke[] = [];
  jumps: NotebookJump[] = [];
  private pieces: Vec2[][] = [];
  private count = 0;

  constructor(private readonly prefix: string) {}

  /** Flat run. */
  flat(len: number): this {
    this.pieces.push(line(this.x, this.y, this.x + len, this.y));
    this.x += len;
    return this;
  }

  /** Smooth ease from the current height by `dy` over `len` px (flat tangents at both ends). */
  ease(len: number, dy: number): this {
    const anchors: [number, number][] = [];
    for (let i = 0; i <= 6; i++)
      anchors.push([this.x + (len * i) / 6, this.y + dy * smooth(i / 6)]);
    this.pieces.push(curve(...anchors));
    this.x += len;
    this.y += dy;
    return this;
  }

  /** A rolling hill or valley: down/up by `dy` and back to the start height. */
  wave(len: number, dy: number): this {
    return this.ease(len / 2, dy).ease(len / 2, -dy);
  }

  /** A gentle half-bowl: ease down, flat bottom, ease back up. */
  bowl(len: number, depth: number, bottom: number): this {
    return this.ease(len, depth).flat(bottom).ease(len, -depth);
  }

  /** Ease downhill for speed, then a launch ramp and a gap to a landing `rise + 60` px below the take-off. */
  kicker(approach: number, rise: number, gapW: number, charge: number): this {
    this.ease(560, approach).flat(120).ramp(340, rise);
    this.gap(gapW, charge, rise + 60);
    return this;
  }

  /** A launch ramp: rises `rise` px over `len` px with a quadratic profile. */
  ramp(len: number, rise: number): this {
    const anchors: [number, number][] = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      anchors.push([this.x + len * t, this.y - rise * t * t]);
    }
    this.pieces.push(curve(...anchors));
    this.x += len;
    this.y -= rise;
    return this;
  }

  /** End the current stroke and jump a gap of `width` px; the next ground is `drop` px lower. */
  gap(width: number, charge: number, drop = 0): this {
    this.jumps.push({ at: this.x - 8, charge });
    this.cut();
    this.x += width;
    this.y += drop;
    return this;
  }

  private cut(): void {
    if (this.pieces.length === 0) return;
    this.strokes.push(stroke(`${this.prefix}${this.count++}`, join(...this.pieces)));
    this.pieces = [];
  }

  /** Close the last stroke and return the strokes. */
  done(): Stroke[] {
    this.cut();
    return this.strokes;
  }
}

function make(
  id: string,
  name: string,
  difficulty: string,
  b: Builder,
  flagX: number,
  startY = 0,
): NotebookCourse {
  const strokes = b.done();
  // The first stroke starts at x=-420, at y=startY (the builder's initial y).
  const level = builtInLevel({
    id,
    name,
    difficulty,
    strokes,
    spawn: pt(60, spawnHeight(startY)),
    flag: pt(flagX, b.y),
  });
  return { level, jumps: b.jumps };
}

/** Level 23: long rolling hills and valleys with lots of flat for manuals. */
function doodleHills(): NotebookCourse {
  const b = new Builder('n23-');
  b.flat(600).wave(1000, 120).flat(700).wave(1200, -90).flat(800).wave(900, 140).flat(700);
  b.wave(1300, 110).flat(1000);
  return make('builtin-23', 'Doodle Hills', 'Easy', b, b.x - 400);
}

/** Level 24: a series of small hops over narrow gaps. */
function marginHop(): NotebookCourse {
  const b = new Builder('n24-');
  b.flat(700);
  const gaps: [number, number, number, number][] = [
    [80, 380, 0, 0.08],
    [90, 420, 10, 0.08],
    [90, 450, 0, 0.08],
    [100, 400, 15, 0.08],
    [100, 520, 0, 0.09],
    [100, 460, 10, 0.09],
    [110, 500, 0, 0.09],
    [90, 380, 0, 0.08],
    [100, 440, 12, 0.09],
    [100, 480, 0, 0.09],
    [110, 420, 10, 0.09],
    [110, 600, 0, 0.09],
  ];
  for (const [w, plat, drop, ch] of gaps) b.gap(w, ch, drop).flat(plat);
  b.ease(500, 60).flat(600);
  return make('builtin-24', 'Margin Hop', 'Easy', b, b.x - 300);
}

/** Level 25: ramp-and-landing jumps for first flips. */
function flipPage(): NotebookCourse {
  const b = new Builder('n25-');
  b.flat(900);
  const rise = [50, 60, 70, 70, 80];
  const gapW = [170, 190, 200, 210, 220];
  const charge = [0.15, 0.15, 0.15, 0.15, 0.15];
  for (let i = 0; i < rise.length; i++) {
    b.kicker(160, rise[i] ?? 60, gapW[i] ?? 300, charge[i] ?? 0.1);
    b.flat(550);
  }
  b.flat(400);
  return make('builtin-25', 'Flip Page', 'Medium', b, b.x - 400);
}

/** Level 26: hills, a gentle half-bowl and small gaps. */
function squiggleBowl(): NotebookCourse {
  const b = new Builder('n26-');
  b.flat(500).wave(900, 100).flat(300).gap(90, 0.08).flat(400);
  b.bowl(500, 160, 400).flat(500).gap(100, 0.08).flat(400);
  b.wave(1000, 120).flat(300).gap(110, 0.09).flat(500);
  b.bowl(600, 190, 500).flat(800);
  return make('builtin-26', 'Squiggle Bowl', 'Medium', b, b.x - 400);
}

/** Level 27: a longer combined course that is still forgiving. */
function inkwellRun(): NotebookCourse {
  const b = new Builder('n27-');
  b.flat(400).wave(800, 110).flat(300);
  b.gap(90, 0.08).flat(300);
  b.bowl(400, 150, 300).flat(300);
  b.kicker(220, 70, 200, 0.15).flat(350);
  b.gap(100, 0.08).flat(250).gap(100, 0.08).flat(300);
  b.wave(800, -90).flat(300);
  b.kicker(200, 80, 230, 0.15).flat(300);
  b.gap(110, 0.09).flat(250).wave(700, 100).flat(700);
  return make('builtin-27', 'Inkwell Run', 'Medium', b, b.x - 400);
}

export function notebookCourses(): NotebookCourse[] {
  return [doodleHills(), marginHop(), flipPage(), squiggleBowl(), inkwellRun()];
}

export function notebookLevels(): Level[] {
  return notebookCourses().map((c) => c.level);
}
