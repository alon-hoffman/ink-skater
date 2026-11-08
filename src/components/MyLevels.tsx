import { useCallback, useEffect, useState } from 'react';
import { arrowNavigate, useDialogFocus, useEscape } from '../app/hooks';
import type { Route } from '../app/navigation';
import { audio, cloud, repositories } from '../app/services';
import { newId } from '../editor/strokeProcessing';
import { formatTime } from '../game/Game';
import type { CloudLevel } from '../levels/cloudLevels';
import { serializeLevel } from '../levels/levelSerialization';
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

type Dialog =
  | { kind: 'rename'; level: Level }
  | { kind: 'delete'; level: Level }
  | { kind: 'cloud' }
  | { kind: 'download' }
  | null;

export function MyLevels({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloudMsg, setCloudMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  useEscape(() => {
    if (!dialog) go({ name: 'menu' });
  });

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

  const upload = async (level: Level): Promise<void> => {
    if (!cloud.isConfigured()) {
      setDialog({ kind: 'cloud' });
      return;
    }
    const overwrite = conflictId === level.id;
    setCloudMsg({ text: `Uploading “${level.name}”…`, bad: false });
    try {
      await cloud.save(level, overwrite);
      setConflictId(null);
      setCloudMsg({ text: `Uploaded “${level.name}” to the cloud.`, bad: false });
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Upload failed.';
      if (/newer version/i.test(text)) {
        setConflictId(level.id);
        setCloudMsg({
          text: `The cloud has a newer “${level.name}”. Press Overwrite cloud to replace it.`,
          bad: true,
        });
      } else {
        setCloudMsg({ text, bad: true });
      }
    }
  };

  const importCloudLevel = async (incoming: Level, mine: boolean): Promise<string> => {
    if (!mine) {
      // Other players' levels become your own copy, which you are free to edit and upload.
      await repositories.levels.save(
        duplicateLevel(incoming, { id: newId('level'), name: incoming.name, now: Date.now() }),
      );
      return `Downloaded “${incoming.name}” as your own copy.`;
    }
    const existing = await repositories.levels.get(incoming.id);
    if (!existing) {
      await repositories.levels.save(incoming);
      return `Downloaded “${incoming.name}”.`;
    }
    if (serializeLevel(existing) === serializeLevel(incoming)) {
      return `“${incoming.name}” is already up to date.`;
    }
    await repositories.levels.save(
      duplicateLevel(incoming, {
        id: newId('level'),
        name: `${incoming.name} copy`.slice(0, 60),
        now: Date.now(),
      }),
    );
    return `Downloaded “${incoming.name}” as a copy (you already have a different version).`;
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <button className="btn small" onClick={() => go({ name: 'menu' })}>
          ← Menu
        </button>
        <h2>My Levels</h2>
        <button className="btn small" onClick={() => setDialog({ kind: 'cloud' })}>
          Cloud
        </button>
        <button
          className="btn primary small"
          onClick={() => go({ name: 'editor', levelId: null, fresh: true })}
        >
          + Create new
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      {cloudMsg && (
        <p className={cloudMsg.bad ? 'error' : 'muted'} role="status">
          {cloudMsg.text}
        </p>
      )}
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
              <div className="my-level-actions" onKeyDown={(e) => arrowNavigate(e)}>
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
                  className="btn small"
                  disabled={draftOnly}
                  onClick={() => void upload(level)}
                >
                  {conflictId === level.id ? 'Overwrite cloud' : 'Upload'}
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
      {dialog?.kind === 'cloud' && (
        <CloudDialog
          onClose={() => setDialog(null)}
          onDownload={() => setDialog({ kind: 'download' })}
        />
      )}
      {dialog?.kind === 'download' && (
        <DownloadDialog
          onClose={() => setDialog(null)}
          onImport={async (level, mine) => {
            const msg = await importCloudLevel(level, mine);
            await refresh();
            return msg;
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          level={dialog.level}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const id = dialog.level.id;
            setDialog(null);
            void run(async () => {
              await repositories.levels.remove(id);
              await repositories.drafts.remove(id);
            });
          }}
        />
      )}
    </main>
  );
}

function DeleteDialog(props: {
  level: Level;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  const ref = useDialogFocus<HTMLDivElement>(props.onCancel);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Confirm delete" ref={ref}>
      <div className="panel">
        <h2>Delete level?</h2>
        <p>“{props.level.name}” will be removed from this device. This can’t be undone.</p>
        <div className="row">
          <button className="btn" onClick={props.onCancel} autoFocus>
            Keep it
          </button>
          <button className="btn danger" onClick={props.onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameDialog(props: {
  level: Level;
  onCancel: () => void;
  onSave: (name: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(props.level.name);
  const ref = useDialogFocus<HTMLDivElement>(props.onCancel);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Rename level" ref={ref}>
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

function CloudDialog(props: { onClose: () => void; onDownload: () => void }): React.JSX.Element {
  const initial = cloud.getConfig();
  const [url, setUrl] = useState(initial.url);
  const [status, setStatus] = useState<{ text: string; bad: boolean } | null>(
    cloud.isConfigured() ? { text: 'Saved on this device.', bad: false } : null,
  );
  const [busy, setBusy] = useState(false);
  const ref = useDialogFocus<HTMLDivElement>(props.onClose);
  const incomplete = url.trim() === '';

  const test = async (): Promise<void> => {
    cloud.setConfig({ url });
    setBusy(true);
    setStatus({ text: 'Testing…', bad: false });
    try {
      const levels = await cloud.list();
      setStatus({ text: `Connected. ${levels.length} level(s) in the cloud.`, bad: false });
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Connection failed.', bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Cloud settings" ref={ref}>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          cloud.setConfig({ url });
          setStatus({ text: 'Saved on this device.', bad: false });
        }}
      >
        <h2>Cloud levels</h2>
        <label className="cloud-field">
          <span className="muted">Web App URL</span>
          <input
            className="text-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p
          className={`cloud-status ${status?.bad ? 'error' : 'muted'}`}
          role="status"
          aria-live="polite"
        >
          {status?.text ?? 'Not set up yet.'}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={props.onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || incomplete}
            onClick={() => void test()}
          >
            Test connection
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || incomplete}
            onClick={() => {
              cloud.setConfig({ url });
              props.onDownload();
            }}
          >
            Download from cloud
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function DownloadDialog(props: {
  onClose: () => void;
  onImport: (level: Level, mine: boolean) => Promise<string>;
}): React.JSX.Element {
  const [items, setItems] = useState<CloudLevel[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const ref = useDialogFocus<HTMLDivElement>(props.onClose);

  const load = useCallback(async () => {
    try {
      const list = await cloud.list();
      setItems(list.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      setItems([]);
      setMsg({ text: e instanceof Error ? e.message : 'Could not load the cloud.', bad: true });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: () => Promise<string>): Promise<void> => {
    try {
      setMsg({ text: await action(), bad: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Something went wrong.', bad: true });
    }
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Download from cloud"
      ref={ref}
    >
      <div className="panel">
        <h2>Download from cloud</h2>
        {items === null ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">No levels found in the cloud.</p>
        ) : (
          <ul className="cloud-list">
            {items.map(({ level, mine }) => (
              <li key={level.id}>
                <strong>{level.name}</strong>
                <span className="row">
                  <button
                    className="btn small primary"
                    onClick={() => void act(() => props.onImport(level, mine))}
                  >
                    Download
                  </button>
                  {mine && (
                    <button
                      className="btn small danger"
                      onClick={() =>
                        void act(async () => {
                          await cloud.remove(level.id);
                          await load();
                          return `Deleted “${level.name}” from the cloud.`;
                        })
                      }
                    >
                      Delete from cloud
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p
          className={`cloud-status ${msg?.bad ? 'error' : 'muted'}`}
          role="status"
          aria-live="polite"
        >
          {msg?.text ?? ''}
        </p>
        <div className="row">
          <button className="btn" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
