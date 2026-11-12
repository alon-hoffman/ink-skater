import { useDialogFocus } from '../app/hooks';
import { formatTime } from '../game/Game';
import type { LevelObjectives } from '../levels/levelTypes';
import { formatLimit } from '../levels/objectives';
import type { LevelProgress, ObjectiveResult } from '../levels/objectives';

/** What the finish screen shows about the three objectives of a built-in level. */
export interface ObjectiveReport {
  targets: LevelObjectives;
  /** What this run achieved. */
  result: ObjectiveResult;
  /** Everything ever achieved on this level, including this run. */
  progress: LevelProgress;
  /** What was already achieved before this run. */
  before: LevelProgress | undefined;
}

export type CompletionInfo =
  | {
      kind: 'play';
      time: number;
      score: number;
      best: number;
      isNewRecord: boolean;
      objectives: ObjectiveReport | null;
    }
  | { kind: 'playtest'; time: number; score: number };

type ObjectiveKey = 'finish' | 'time' | 'score';

function ObjectiveList(props: {
  report: ObjectiveReport;
  time: number;
  score: number;
}): React.JSX.Element {
  const { report, time, score } = props;
  const rows: { key: ObjectiveKey; label: string; yours: string }[] = [
    { key: 'finish', label: 'Reach the flag', yours: '' },
    {
      key: 'time',
      label: `Finish under ${formatLimit(report.targets.timeLimit)}`,
      yours: `you: ${formatTime(time)}`,
    },
    {
      key: 'score',
      label: `Finish with ${report.targets.scoreTarget}+ points`,
      yours: `you: ${score}`,
    },
  ];
  return (
    <ul className="objective-list" aria-label="Objectives">
      {rows.map((row) => {
        const met = report.result[row.key];
        const earned = report.progress[row.key];
        const isNew = met && !(report.before?.[row.key] ?? false);
        const note = isNew ? 'New!' : met ? 'again' : earned ? 'earned before' : row.yours;
        return (
          <li key={row.key} className={met ? 'obj-row met' : earned ? 'obj-row earned' : 'obj-row'}>
            <span className={earned ? 'obj-box done' : 'obj-box'} aria-hidden="true" />
            <span className="obj-label">{row.label}</span>
            <span className="obj-note">{note}</span>
            <span className="sr-only">{earned ? '(done)' : '(not done)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

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
  const ref = useDialogFocus<HTMLDivElement>(onExit);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Level complete" ref={ref}>
      <div className="panel complete">
        <div className="flag-doodle" aria-hidden="true" />
        <h2>{info.kind === 'playtest' ? 'Playtest cleared!' : 'You made it!'}</h2>
        <p className="level-title">{levelName}</p>
        <p className="big-time">{formatTime(info.time)}</p>
        <p className="big-score">Score {info.score}</p>
        {info.kind === 'play' ? (
          <>
            {info.objectives && (
              <ObjectiveList report={info.objectives} time={info.time} score={info.score} />
            )}
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
                <button className="btn primary" onClick={onNext} autoFocus>
                  Next Level
                </button>
              )}
              <button className="btn" onClick={onExit} autoFocus={!onNext}>
                Return to Menu
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={onRestart}>
                Retry
              </button>
              <button className="btn primary" onClick={onExit} autoFocus>
                Back to Editor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
