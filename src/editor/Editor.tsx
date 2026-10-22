import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PORTRAIT_QUERY, useMediaQuery } from '../app/hooks';
import { audio, repositories } from '../app/services';
import { GameScreen } from '../components/GameScreen';
import { RotatePrompt } from '../components/RotatePrompt';
import type { Level } from '../levels/levelTypes';
import { isValidated } from '../levels/levelValidation';
import { EditorController } from './EditorController';
import type { EditorTool } from './EditorController';
import { EditorSession } from './EditorSession';
import { loadEditorLevel } from './editorLoader';

const AUTOSAVE_MS = 600;

interface EditorProps {
  levelId: string | null;
  fresh: boolean;
  onExit: () => void;
}

export function Editor({ levelId, fresh, onExit }: EditorProps): React.JSX.Element {
  const [session, setSession] = useState<EditorSession | null>(null);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadEditorLevel({ levelId, fresh, repos: repositories, now: Date.now() }).then(
      (loaded) => {
        if (!alive) return;
        setSession(new EditorSession(loaded.level, Date.now, loaded.dirty));
        setRecovered(loaded.recovered);
      },
    );
    return () => {
      alive = false;
    };
  }, [levelId, fresh]);

  if (!session) {
    return (
      <main className="screen">
        <p className="muted">Opening editor…</p>
      </main>
    );
  }
  return <EditorWorkspace session={session} recovered={recovered} onExit={onExit} />;
}

const TOOLS: Array<{ tool: EditorTool; label: string; hint: string; icon: string }> = [
  { tool: 'draw', label: 'Draw', hint: 'Draw terrain (D)', icon: '✏️' },
  { tool: 'select', label: 'Select', hint: 'Select a stroke (V)', icon: '👆' },
  { tool: 'move', label: 'Move', hint: 'Drag the selected stroke (M)', icon: '✥' },
  { tool: 'pan', label: 'Pan', hint: 'Pan the view (H, or hold Space)', icon: '✋' },
  { tool: 'spawn', label: 'Spawn', hint: 'Place the skater (S)', icon: '🛹' },
  { tool: 'flag', label: 'Flag', hint: 'Place the goal flag (F)', icon: '🚩' },
];

interface PlaytestState {
  level: Level;
  revision: number;
}

function EditorWorkspace(props: {
  session: EditorSession;
  recovered: boolean;
  onExit: () => void;
}): React.JSX.Element {
  const { session, onExit } = props;
  useSyncExternalStore(session.subscribe, session.getVersion);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<EditorController | null>(null);
  const [tool, setTool] = useState<EditorTool>('draw');
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'error' | 'info' } | null>(
    props.recovered ? { text: 'Restored your unsaved draft', tone: 'info' } : null,
  );
  const [playtest, setPlaytest] = useState<PlaytestState | null>(null);
  const [justValidated, setJustValidated] = useState(false);
  const portrait = useMediaQuery(PORTRAIT_QUERY);
  const statusTimer = useRef(0);

  const flash = useCallback((text: string, tone: 'ok' | 'error' | 'info'): void => {
    setStatus({ text, tone });
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 2600);
  }, []);

  // Canvas controller lifecycle.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || playtest) return;
    const controller = new EditorController(canvas, session, setTool);
    controller.tool = tool;
    controllerRef.current = controller;
    controller.attach();
    return () => {
      controller.detach();
      controllerRef.current = null;
    };
    // Re-created after a playtest; the tool is re-applied from state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, playtest === null]);

  // Debounced autosave of the working draft.
  const saveDraft = useCallback((): void => {
    if (!session.dirty) return;
    void repositories.drafts.save(session.level, Date.now()).catch(() => {
      flash('Autosave failed (storage full?)', 'error');
    });
  }, [session, flash]);

  useEffect(() => {
    let timer = 0;
    const unsub = session.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(saveDraft, AUTOSAVE_MS);
    });
    const onHide = (): void => {
      window.clearTimeout(timer);
      saveDraft();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    if (session.dirty) timer = window.setTimeout(saveDraft, AUTOSAVE_MS);
    return () => {
      unsub();
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      saveDraft();
    };
  }, [session, saveDraft]);

  const save = async (): Promise<void> => {
    try {
      await repositories.levels.save(session.level);
      await repositories.drafts.remove(session.level.id);
      session.markSaved();
      flash('Saved ✓', 'ok');
    } catch {
      flash('Could not save — browser storage may be full or blocked', 'error');
    }
  };

  const startPlaytest = (): void => {
    audio.unlock();
    session.select(null);
    setJustValidated(false);
    saveDraft();
    setPlaytest({ level: session.level, revision: session.level.revision });
  };

  const level = session.level;
  const validated = isValidated(level);

  if (playtest) {
    return (
      <GameScreen
        key={playtest.revision}
        level={playtest.level}
        mode="playtest"
        validated={justValidated}
        onPlaytestComplete={(time) => {
          const ok = session.validate({ revision: playtest.revision, time });
          setJustValidated(ok);
        }}
        onExit={() => setPlaytest(null)}
      />
    );
  }

  const changeTool = (t: EditorTool): void => {
    setTool(t);
    controllerRef.current?.setTool(t);
  };

  return (
    <div className="editor">
      <header className="editor-bar">
        <button
          className="btn small"
          onClick={() => {
            saveDraft();
            onExit();
          }}
        >
          ← Menu
        </button>
        <input
          className="text-input name-input"
          value={level.name}
          maxLength={60}
          onChange={(e) => session.rename(e.target.value)}
          aria-label="Level name"
        />
        <span
          className={`chip ${validated ? 'ok' : ''}`}
          title="Complete a playtest to validate this version"
        >
          {validated ? '✓ validated' : 'unvalidated'}
        </span>
        <span className="grow" />
        {status && <span className={`status ${status.tone}`}>{status.text}</span>}
        {!status && session.dirty && (
          <span className="status info">unsaved changes · autosaving</span>
        )}
        <button className="btn small" onClick={() => void save()}>
          Save
        </button>
        <button className="btn small primary playtest-btn" onClick={startPlaytest}>
          ▶ Playtest
        </button>
      </header>

      <div className="editor-body">
        <aside className="toolbar" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              className={`tool ${tool === t.tool ? 'active' : ''}`}
              title={t.hint}
              onClick={() => changeTool(t.tool)}
              aria-pressed={tool === t.tool}
            >
              <span className="tool-icon" aria-hidden="true">
                {t.icon}
              </span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
          <span className="tool-sep" />
          <button
            className="tool"
            title="Undo (Ctrl+Z)"
            disabled={!session.canUndo}
            onClick={() => session.undo()}
          >
            <span className="tool-icon" aria-hidden="true">
              ↶
            </span>
            <span className="tool-label">Undo</span>
          </button>
          <button
            className="tool"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!session.canRedo}
            onClick={() => session.redo()}
          >
            <span className="tool-icon" aria-hidden="true">
              ↷
            </span>
            <span className="tool-label">Redo</span>
          </button>
          <button
            className="tool danger"
            title="Delete selected stroke (Del)"
            disabled={session.selectedId === null}
            onClick={() => controllerRef.current?.deleteSelected()}
          >
            <span className="tool-icon" aria-hidden="true">
              🗑
            </span>
            <span className="tool-label">Delete</span>
          </button>
          <span className="tool-sep" />
          <button
            className="tool"
            title="Flip which way the skater faces"
            onClick={() =>
              controllerRef.current?.setSpawnDirection(level.spawnDirection === 1 ? -1 : 1)
            }
          >
            <span className="tool-icon" aria-hidden="true">
              {level.spawnDirection === 1 ? '➡' : '⬅'}
            </span>
            <span className="tool-label">Facing</span>
          </button>
          <button
            className="tool"
            title="Zoom in"
            onClick={() => controllerRef.current?.zoomBy(1.3)}
          >
            <span className="tool-icon" aria-hidden="true">
              ＋
            </span>
            <span className="tool-label">Zoom in</span>
          </button>
          <button
            className="tool"
            title="Zoom out"
            onClick={() => controllerRef.current?.zoomBy(1 / 1.3)}
          >
            <span className="tool-icon" aria-hidden="true">
              －
            </span>
            <span className="tool-label">Zoom out</span>
          </button>
          <button
            className="tool"
            title="Fit the whole level in view"
            onClick={() => controllerRef.current?.fitView()}
          >
            <span className="tool-icon" aria-hidden="true">
              ⤢
            </span>
            <span className="tool-label">Fit</span>
          </button>
        </aside>
        <canvas ref={canvasRef} className="editor-canvas" />
      </div>
      {portrait && <RotatePrompt />}
    </div>
  );
}
