import { describe, expect, it } from 'vitest';
import {
  History,
  addStroke,
  deleteStroke,
  moveStroke,
  setFlag,
  setSpawn,
} from '../src/editor/editorCommands';
import { EditorSession } from '../src/editor/EditorSession';
import { createStroke, findStrokeAt, processFreehand } from '../src/editor/strokeProcessing';
import { isValidated, newCustomLevel } from '../src/levels/levelValidation';

const raw = (n: number, dy = 0) =>
  Array.from({ length: n }, (_, i) => ({ x: i * 4, y: dy + Math.sin(i / 6) * 10 }));

function makeSession(): EditorSession {
  let t = 1000;
  return new EditorSession(newCustomLevel({ id: 'e', name: 'E', now: 1 }), () => t++);
}

function need<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('expected a value');
  return v;
}

describe('stroke processing', () => {
  it('turns a freehand scribble into evenly spaced control points', () => {
    const pts = need(processFreehand(raw(120)));
    expect(pts.length).toBeGreaterThan(10);
    expect(pts.length).toBeLessThan(120);
    expect(pts[0]?.x).toBe(0);
  });

  it('discards taps', () => {
    expect(
      createStroke([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBeNull();
  });

  it('finds the nearest stroke without joining strokes', () => {
    const a = need(createStroke(raw(60, 0)));
    const b = need(createStroke(raw(60, 100)));
    expect(findStrokeAt([a, b], { x: 100, y: 100 }, 20)?.id).toBe(b.id);
    expect(findStrokeAt([a, b], { x: 100, y: 500 }, 20)).toBeNull();
  });
});

describe('History', () => {
  it('undoes and redoes, and clears redo on a new commit', () => {
    const h = new History(0);
    h.commit(1);
    h.commit(2);
    expect(h.undo()).toBe(1);
    expect(h.undo()).toBe(0);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe(1);
    h.commit(5);
    expect(h.canRedo).toBe(false);
    expect(h.present).toBe(5);
  });
});

describe('EditorSession undo/redo across every edit type', () => {
  it('draw, move, delete, place spawn and flag all undo and redo', () => {
    const s = makeSession();
    const stroke = need(createStroke(raw(60)));
    s.edit(addStroke(s.content, stroke));
    s.edit(moveStroke(s.content, stroke.id, 50, 20));
    s.edit(setSpawn(s.content, { x: 1, y: 2 }));
    s.edit(setFlag(s.content, { x: 3, y: 4 }));
    const moved = need(s.content.strokes.find((x) => x.id === stroke.id));
    expect(moved.points[0]?.x).toBeCloseTo((stroke.points[0]?.x ?? 0) + 50);
    s.edit(deleteStroke(s.content, stroke.id));
    const afterDelete = s.content.strokes.length;

    s.undo();
    expect(s.content.strokes).toHaveLength(afterDelete + 1);
    expect(s.content.flag).toEqual({ x: 3, y: 4 });
    s.undo();
    expect(s.content.flag).not.toEqual({ x: 3, y: 4 });
    expect(s.content.spawn).toEqual({ x: 1, y: 2 });
    s.undo();
    expect(s.content.spawn).not.toEqual({ x: 1, y: 2 });
    s.undo();
    expect(s.content.strokes.find((x) => x.id === stroke.id)?.points[0]).toEqual(stroke.points[0]);
    s.undo();
    expect(s.content.strokes.find((x) => x.id === stroke.id)).toBeUndefined();
    expect(s.canUndo).toBe(false);

    for (let i = 0; i < 6; i++) s.redo();
    expect(s.content.strokes.find((x) => x.id === stroke.id)).toBeUndefined();
    expect(s.canRedo).toBe(false);
    expect(s.content.flag).toEqual({ x: 3, y: 4 });
  });

  it('edits invalidate validation, including undo, and selection follows deletes', () => {
    const s = makeSession();
    const stroke = need(createStroke(raw(60)));
    s.edit(addStroke(s.content, stroke));
    expect(s.validate({ revision: s.level.revision, time: 4 })).toBe(true);
    expect(isValidated(s.level)).toBe(true);
    s.select(stroke.id);
    s.edit(deleteStroke(s.content, stroke.id));
    expect(s.selectedId).toBeNull();
    expect(isValidated(s.level)).toBe(false);
    s.validate({ revision: s.level.revision, time: 5 });
    s.undo();
    expect(isValidated(s.level)).toBe(false);
  });

  it('renaming does not invalidate', () => {
    const s = makeSession();
    s.validate({ revision: s.level.revision, time: 1 });
    s.rename('New name');
    expect(isValidated(s.level)).toBe(true);
    expect(s.level.name).toBe('New name');
  });
});
