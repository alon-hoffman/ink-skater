import { useState } from 'react';
import { audio } from '../app/services';
import type { Route } from '../app/navigation';

export function MainMenu({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const [muted, setMuted] = useState(audio.isMuted);
  const enter = (route: Route): void => {
    audio.unlock();
    audio.click();
    go(route);
  };
  const canFullscreen =
    document.fullscreenEnabled && !window.matchMedia('(display-mode: fullscreen)').matches;
  return (
    <main className="screen menu-screen">
      <div className="title-block">
        <h1 className="logo">
          <span>Ink</span> <span>Skater</span>
        </h1>
        <svg className="logo-doodle" viewBox="0 0 320 90" aria-hidden="true">
          <path d="M6 70 C 60 70, 80 70, 120 56 S 190 20, 240 30 S 290 66, 314 64" />
          <circle cx="126" cy="76" r="7" />
          <circle cx="164" cy="76" r="7" />
          <path d="M112 66 L178 66" />
          <circle cx="148" cy="28" r="8" />
          <path d="M148 36 L148 56 M148 42 L134 50 M148 42 L162 48 M148 56 L138 66 M148 56 L160 66" />
        </svg>
        <p className="tagline">Reach the flag. Don't hit your head.</p>
      </div>
      <nav className="menu-buttons">
        <button className="btn big primary" onClick={() => enter({ name: 'levels' })}>
          Play
        </button>
        <button
          className="btn big"
          onClick={() => enter({ name: 'editor', levelId: null, fresh: false })}
        >
          Level Editor
        </button>
        <button className="btn big" onClick={() => enter({ name: 'myLevels' })}>
          My Levels
        </button>
      </nav>
      {canFullscreen && (
        <button
          className="btn small corner-left"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          }}
        >
          ⛶ Fullscreen
        </button>
      )}
      <button
        className="btn small corner"
        onClick={() => {
          audio.unlock();
          audio.setMuted(!audio.isMuted);
          setMuted(audio.isMuted);
        }}
      >
        {muted ? '🔇 Sound off' : '🔊 Sound on'}
      </button>
    </main>
  );
}
