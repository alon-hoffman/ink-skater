import { describe, expect, it } from 'vitest';
import { loadEditorLevel } from '../src/editor/editorLoader';
import { BUILT_IN_LEVELS } from '../src/levels/builtInLevels';
import { deserializeLevel, parseLevel, serializeLevel } from '../src/levels/levelSerialization';
import {
  applyContentEdit,
  contentOf,
  isValidated,
  newCustomLevel,
  recordValidation,
} from '../src/levels/levelValidation';
import {
  MemoryStorage,
  STORAGE_KEYS,
  createLocalRepositories,
} from '../src/levels/localLevelRepository';

const base = () => newCustomLevel({ id: 'lvl-1', name: 'Test', now: 1000 });

describe('validation', () => {
  it('a new level is unvalidated; a matching completion validates it', () => {
    const level = base();
    expect(isValidated(level)).toBe(false);
    const v = recordValidation(level, { revision: level.revision, time: 12, at: 5 });
    expect(isValidated(v)).toBe(true);
    expect(v.validation.completionTime).toBe(12);
  });

  it('any gameplay edit invalidates validation', () => {
    const v = recordValidation(base(), { revision: 1, time: 3, at: 1 });
    const edited = applyContentEdit(v, { ...contentOf(v), flag: { x: 999, y: 10 } }, 2000);
    expect(edited.revision).toBe(v.revision + 1);
    expect(isValidated(edited)).toBe(false);
    const turned = applyContentEdit(v, { ...contentOf(v), spawnDirection: -1 }, 2000);
    expect(isValidated(turned)).toBe(false);
  });

  it('an identical edit keeps the validation', () => {
    const v = recordValidation(base(), { revision: 1, time: 3, at: 1 });
    const same = applyContentEdit(v, { ...contentOf(v) }, 2000);
    expect(same).toBe(v);
    expect(isValidated(same)).toBe(true);
  });

  it('a stale playtest cannot validate a newer revision', () => {
    const level = base();
    const edited = applyContentEdit(level, { ...contentOf(level), spawn: { x: 5, y: 5 } }, 2);
    const result = recordValidation(edited, { revision: level.revision, time: 3, at: 3 });
    expect(isValidated(result)).toBe(false);
  });
});

describe('serialization', () => {
  it('round-trips a level', () => {
    const level = base();
    expect(deserializeLevel(serializeLevel(level))).toEqual(level);
  });

  it('rejects malformed data and sanitises partial data', () => {
    expect(deserializeLevel('not json')).toBeNull();
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel({ id: 'x' })).toBeNull();
    expect(
      parseLevel({ id: 'x', spawn: { x: 1, y: 2 }, flag: { x: 'bad', y: 2 }, strokes: [] }),
    ).toBeNull();
    const ok = parseLevel({
      id: 'x',
      name: '',
      spawn: { x: 1, y: 2 },
      flag: { x: 10, y: 2 },
      strokes: [
        {
          points: [
            { x: 0, y: 0 },
            { x: NaN, y: 1 },
            { x: 5, y: 5 },
          ],
        },
        { points: [{ x: 1, y: 1 }] },
      ],
    });
    expect(ok?.name).toBe('Untitled');
    expect(ok?.strokes).toHaveLength(1);
    expect(ok?.strokes[0]?.points).toHaveLength(2);
  });
});

describe('repositories', () => {
  it('saves, lists and removes levels, and survives corrupted storage', async () => {
    const storage = new MemoryStorage();
    const repos = createLocalRepositories(storage);
    await repos.levels.save(base());
    expect((await repos.levels.list()).map((l) => l.id)).toEqual(['lvl-1']);
    expect((await repos.levels.get('lvl-1'))?.name).toBe('Test');
    storage.setItem(STORAGE_KEYS.levels, '{{{');
    expect(await repos.levels.list()).toEqual([]);
    await repos.levels.save(base());
    await repos.levels.remove('lvl-1');
    expect(await repos.levels.list()).toEqual([]);
  });

  it('keeps only the best time per level', async () => {
    const repos = createLocalRepositories(new MemoryStorage());
    expect((await repos.records.submit('a', 20)).isNewRecord).toBe(true);
    expect((await repos.records.submit('a', 25)).isNewRecord).toBe(false);
    const better = await repos.records.submit('a', 18);
    expect(better).toMatchObject({ isNewRecord: true, previousBest: 20, best: 18 });
    expect(await repos.records.getBest('a')).toBe(18);
  });

  it('the editor reopens the newer draft and resumes an unsaved new level', async () => {
    const repos = createLocalRepositories(new MemoryStorage());
    const saved = base();
    await repos.levels.save(saved);
    const draft = applyContentEdit(saved, { ...contentOf(saved), flag: { x: 5, y: 5 } }, 5000);
    await repos.drafts.save(draft, 5000);
    const reopened = await loadEditorLevel({ levelId: 'lvl-1', fresh: false, repos, now: 6000 });
    expect(reopened.recovered).toBe(true);
    expect(reopened.level.flag).toEqual({ x: 5, y: 5 });

    const orphan = newCustomLevel({ id: 'orphan', name: 'Orphan', now: 7000 });
    await repos.drafts.save(orphan, 7000);
    const resumed = await loadEditorLevel({ levelId: null, fresh: false, repos, now: 8000 });
    expect(resumed.level.id).toBe('orphan');
    const fresh = await loadEditorLevel({ levelId: null, fresh: true, repos, now: 8000 });
    expect(fresh.level.id).not.toBe('orphan');
  });
});

describe('built-in levels', () => {
  it('there are eight, each with strokes, a spawn and a flag', () => {
    expect(BUILT_IN_LEVELS).toHaveLength(8);
    for (const l of BUILT_IN_LEVELS) {
      expect(l.kind).toBe('builtin');
      expect(l.strokes.length).toBeGreaterThan(0);
      expect(l.flag).not.toEqual(l.spawn);
    }
  });
});
