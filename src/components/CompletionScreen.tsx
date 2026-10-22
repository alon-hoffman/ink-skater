import { formatTime } from '../game/Game';

export type CompletionInfo =
  | { kind: 'play'; time: number; best: number; isNewRecord: boolean }
  | { kind: 'playtest'; time: number };

interface CompletionScreenProps {
  levelName: string;
  info: CompletionInfo;
  validated: boolean;
  onRestart: () => void;
  onNext?: (() => void) | undefined;
  onExit: () => void;
}

export function CompletionScreen(props: CompletionScreenProps): React.JSX.Element {
  const { levelName, info, validated, onRestart, onNext, onExit } = props;
  return (
    <div className="overlay" role="dialog" aria-label="Level complete">
      <div className="panel complete">
        <div className="flag-doodle" aria-hidden="true" />
        <h2>{info.kind === 'playtest' ? 'Playtest cleared!' : 'You made it!'}</h2>
        <p className="level-title">{levelName}</p>
        <p className="big-time">{formatTime(info.time)}</p>
        {info.kind === 'play' ? (
          <>
            {info.isNewRecord ? (
              <p className="record">★ New Record! ★</p>
            ) : (
              <p className="muted">Personal best: {formatTime(info.best)}</p>
            )}
          </>
        ) : (
          <p className={validated ? 'validated' : 'muted'}>
            {validated ? '✓ Level validated' : 'This revision was already validated'}
          </p>
        )}
        <div className="row">
          {info.kind === 'play' ? (
            <>
              <button className="btn" onClick={onRestart}>
                Restart
              </button>
              {onNext && (
                <button className="btn primary" onClick={onNext}>
                  Next Level
                </button>
              )}
              <button className="btn" onClick={onExit}>
                Return to Menu
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={onRestart}>
                Retry
              </button>
              <button className="btn primary" onClick={onExit}>
                Back to Editor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
