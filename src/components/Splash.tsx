import { useEffect, useRef } from 'react';
import type { Route } from '../app/navigation';
import { MENU } from '../app/navigation';
import { audio } from '../app/services';
import splashUrl from '../assets/splash.png';

/** Title picture shown when the game opens. Any key, click or tap goes on to the main menu. */
export function Splash({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const done = useRef(false);

  useEffect(() => {
    const proceed = (): void => {
      if (done.current) return;
      done.current = true;
      audio.unlock();
      go(MENU);
    };
    const onKey = (e: KeyboardEvent): void => {
      // Browser shortcuts (reload, dev tools, copy...) are not "start".
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(e.key)) return;
      if (e.key.startsWith('F') && e.key.length > 1 && /^F\d+$/.test(e.key)) return;
      e.preventDefault();
      proceed();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', proceed);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', proceed);
    };
  }, [go]);

  return (
    <main className="splash" aria-label="Ink Skater. Press any key to start.">
      <img className="splash-image" src={splashUrl} alt="Ink Skater: Press Any Key to Start" />
    </main>
  );
}
