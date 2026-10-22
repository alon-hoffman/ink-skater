interface PauseMenuProps {
  mode: 'play' | 'playtest';
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function PauseMenu({
  mode,
  onResume,
  onRestart,
  onExit,
}: PauseMenuProps): React.JSX.Element {
  return (
    <div className="overlay" role="dialog" aria-label="Paused">
      <div className="panel">
        <h2>Paused</h2>
        <div className="stack">
          <button className="btn primary" onClick={onResume} autoFocus>
            Resume
          </button>
          <button className="btn" onClick={onRestart}>
            Restart
          </button>
          <button className="btn" onClick={onExit}>
            {mode === 'playtest' ? 'Back to Editor' : 'Main Menu'}
          </button>
        </div>
        <p className="muted small">Esc resumes · R restarts</p>
      </div>
    </div>
  );
}
