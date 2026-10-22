import { useCallback, useEffect, useRef, useState } from 'react';
import { PORTRAIT_QUERY, useMediaQuery } from '../app/hooks';
import { audio, repositories } from '../app/services';
import { Game } from '../game/Game';
import type { Level } from '../levels/levelTypes';
import { CompletionScreen } from './CompletionScreen';
import type { CompletionInfo } from './CompletionScreen';
import { PauseMenu } from './PauseMenu';
import { RotatePrompt } from './RotatePrompt';

export interface GameScreenProps {
  level: Level;
  mode: 'play' | 'playtest';
  /** Return to the menu (play) or to the editor (playtest). */
  onExit: () => void;
  /** Play mode only: go to the next level when there is one. */
  onNext?: (() => void) | undefined;
  /** Playtest only: called once when the level is completed, before the overlay shows. */
  onPlaytestComplete?: ((time: number) => void) | undefined;
  /** Playtest only: whether the completion validated the level (shown on the overlay). */
  validated?: boolean | undefined;
}

export function GameScreen(props: GameScreenProps): React.JSX.Element {
  const { level, mode } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const chargeRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [paused, setPaused] = useState(false);
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  const [muted, setMuted] = useState(audio.isMuted);
  const portrait = useMediaQuery(PORTRAIT_QUERY);

  useEffect(() => {
    const canvas = canvasRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!canvas || !left || !right) return;
    const game = new Game({
      canvas,
      level,
      audio,
      hud: { time: timeRef.current, charge: chargeRef.current },
      onPauseChange: setPaused,
      onComplete: (time) => {
        const p = propsRef.current;
        if (p.mode === 'playtest') {
          p.onPlaytestComplete?.(time);
          setCompletion({ kind: 'playtest', time });
          return;
        }
        void repositories.records.submit(level.id, time).then(
          (result) =>
            setCompletion({
              kind: 'play',
              time,
              best: result.best,
              isNewRecord: result.isNewRecord,
            }),
          () => setCompletion({ kind: 'play', time, best: time, isNewRecord: false }),
        );
      },
    });
    game.attachTouchZones(left, right);
    gameRef.current = game;
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // The game is rebuilt only when the level object changes (callers remount per level/playtest).
  }, [level]);

  useEffect(() => {
    if (portrait) gameRef.current?.pause();
  }, [portrait]);

  const restart = useCallback(() => {
    setCompletion(null);
    setPaused(false);
    gameRef.current?.restart();
  }, []);

  const pause = useCallback(() => gameRef.current?.pause(), []);
  const resume = useCallback(() => gameRef.current?.resume(), []);

  const toggleMute = (): void => {
    audio.unlock();
    audio.setMuted(!audio.isMuted);
    setMuted(audio.isMuted);
  };

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="touch-zones" aria-hidden="true">
        <div ref={leftRef} className="touch-zone touch-left">
          <span>↺ tilt</span>
        </div>
        <div ref={rightRef} className="touch-zone touch-right">
          <span>tilt ↻</span>
        </div>
      </div>
      <header className="hud">
        <div className="hud-left">
          <span className="hud-level">{level.name}</span>
          {mode === 'playtest' && <span className="badge">playtest</span>}
        </div>
        <div className="hud-center">
          <span ref={timeRef} className="hud-time">
            0:00.00
          </span>
          <div className="charge-track" title="Jump charge">
            <div ref={chargeRef} className="charge-fill" />
          </div>
        </div>
        <div className="hud-right">
          <button
            className="icon-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title="Sound"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="icon-btn" onClick={restart} aria-label="Restart" title="Restart (R)">
            ↻
          </button>
          <button className="icon-btn" onClick={pause} aria-label="Pause" title="Pause (Esc)">
            ❚❚
          </button>
        </div>
      </header>
      <p className="hud-hint">Hold both sides (or Space) to charge a jump · release to launch</p>

      {paused && !completion && !portrait && (
        <PauseMenu mode={mode} onResume={resume} onRestart={restart} onExit={props.onExit} />
      )}
      {completion && (
        <CompletionScreen
          levelName={level.name}
          info={completion}
          validated={props.validated ?? false}
          onRestart={restart}
          onNext={props.onNext}
          onExit={props.onExit}
        />
      )}
      {portrait && <RotatePrompt />}
    </div>
  );
}
