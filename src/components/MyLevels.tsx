import { useCallback, useEffect, useState } from 'react';
import type { Route } from '../app/navigation';
import { audio, repositories } from '../app/services';
import { newId } from '../editor/strokeProcessing';
import { formatTime } from '../game/Game';
import type { Level } from '../levels/levelTypes';
import { duplicateLevel, isValidated, renameLevel } from '../levels/levelValidation';

interface Entry {
  level: Level;
  /** Never saved: only a draft exists. */
  draftOnly: boolean;
  /** A newer autosaved draft exists than the saved copy. */
  hasNewerDraft: boolean;
  best: number | null;
}

type Dialog = { kind: 'rename'; level: Level } | { kind: 'delete'; level: Level } | null;

export function MyLevels({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [saved, drafts, bests] = await Promise.all([
      repositories.levels.list(),
      repositories.drafts.list(),
      repositories.records.getAllBests(),
    ]);
    const savedIds = new Set(saved.map((l) => l.id));
    const list: Entry[] = saved.map((level) => {
      const draft = drafts.find((d) => d.level.id === level.id);
      return {
        level,
        draftOnly: false,
        hasNewerDraft: !!draft && draft.level.updatedAt > level.updatedAt,
        best: bests[level.id] ?? null,
      };
    });
    for (const d of drafts) {
      if (!savedIds.has(d.level.id)) {
        list.push({ level: d.level, draftOnly: true, hasNewerDraft: false, best: null });
      }
    }
    setEntries(list);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      setError(null);
      await action();
      await refresh();
    } catch {
      setError('Could not update your saved levels (is browser storage full or blocked?).');
    }
  };

  const duplicate = (level: Level): Promise<void> =>
    run(() =>
      repositories.levels.save(
        duplicateLevel(level, {
          id: newId('level'),
          name: `${level.name} copy`.slice(0, 60),
          now: Date.now(),
        }),
      ),
    );

  return (
    <main className="screen">
      <header className="screen-header">
        <button className="btn small" onClick={() => go({ name: 'menu' })}>
          ← Menu
        </button>
        <h2>My Levels</h2>
        <button
          className="btn primary small"
          onClick={() => go({ name: 'editor', levelId: null, fresh: true })}
        >
          + Create new
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="empty">
          <p>No levels yet. Draw your first course!</p>
          <button
            className="btn primary"
            onClick={() => go({ name: 'editor', levelId: null, fresh: true })}
          >
            Create a level
          </button>
        </div>
      ) : (
        <ul className="my-levels">
          {entries.map(({ level, draftOnly, hasNewerDraft, best }) => (
            <li key={level.id} className="my-level">
              <div className="my-level-info">
                <strong>{level.name}</strong>
                <span className="chips">
                  {draftOnly ? (
                    <span className="chip warn">unsaved draft</span>
                  ) : isValidated(level) ? (
                    <span className="chip ok">✓ validated</span>
                  ) : (
                    <span className="chip">unvalidated</span>
                  )}
                  {hasNewerDraft && <span className="chip warn">unsaved changes</span>}
                  {best !== null && <span className="chip">best {formatTime(best)}</span>}
                  <span className="chip faint">{level.strokes.length} strokes</span>
                </span>
              </div>
              <div className="my-level-actions">
                <button
                  className="btn small primary"
                  disabled={draftOnly}
                  title={draftOnly ? 'Save the level in the editor first' : 'Play'}
                  onClick={() => {
                    audio.unlock();
                    go({ name: 'play', levelId: level.id, from: 'myLevels' });
                  }}
                >
                  Play
                </button>
                <button
                  className="btn small"
                  onClick={() => go({ name: 'editor', levelId: level.id, fresh: false })}
                >
                  Edit
                </button>
                <button
                  className="btn small"
                  disabled={draftOnly}
                  onClick={() => setDialog({ kind: 'rename', level })}
                >
                  Rename
                </button>
                <button
                  className="btn small"
                  disabled={draftOnly}
                  onClick={() => void duplicate(level)}
                >
                  Duplicate
                </button>
                <button
                  className="btn small danger"
                  onClick={() => setDialog({ kind: 'delete', level })}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'rename' && (
        <RenameDialog
          level={dialog.level}
          onCancel={() => setDialog(null)}
          onSave={(name) => {
            const next = renameLevel(dialog.level, name, Date.now());
            setDialog(null);
            void run(() => repositories.levels.save(next));
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <div className="overlay" role="dialog" aria-label="Confirm delete">
          <div className="panel">
            <h2>Delete level?</h2>
            <p>“{dialog.level.name}” will be removed from this device. This can’t be undone.</p>
            <div className="row">
              <button className="btn" onClick={() => setDialog(null)} autoFocus>
                Keep it
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const id = dialog.level.id;
                  setDialog(null);
                  void run(async () => {
                    await repositories.levels.remove(id);
                    await repositories.drafts.remove(id);
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RenameDialog(props: {
  level: Level;
  onCancel: () => void;
  onSave: (name: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(props.level.name);
  return (
    <div className="overlay" role="dialog" aria-label="Rename level">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave(name);
        }}
      >
        <h2>Rename level</h2>
        <input
          className="text-input"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          aria-label="Level name"
        />
        <div className="row">
          <button type="button" className="btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={name.trim() === ''}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
