import { useDialogFocus } from '../app/hooks';

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
  // Escape resumes via the game's own key handler, so no onEscape here.
  const ref = useDialogFocus<HTMLDivElement>();
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Paused" ref={ref}>
      <div className="panel">
        <h2>Paused</h2>
        <div className="stack">
          <button className="btn primary" onClick={onResume}>
            Resume
          </button>
          <button className="btn" onClick={onRestart}>
            Restart
          </button>
          <button className="btn" onClick={onExit}>
            {mode === 'playtest' ? 'Back to Editor' : 'Main Menu'}
          </button>
        </div>
        <p className="muted small">Esc resumes · R restarts · Tab to move, Enter to select</p>
      </div>
    </div>
  );
}
