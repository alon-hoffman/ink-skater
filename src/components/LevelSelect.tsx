import { useEffect, useState } from 'react';
import type { Route } from '../app/navigation';
import { audio, repositories } from '../app/services';
import { formatTime } from '../game/Game';
import { BUILT_IN_LEVELS } from '../levels/builtInLevels';

export function LevelSelect({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const [bests, setBests] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    void repositories.records.getAllBests().then((b) => {
      if (alive) setBests(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="screen">
      <header className="screen-header">
        <button className="btn small" onClick={() => go({ name: 'menu' })}>
          ← Menu
        </button>
        <h2>Choose a level</h2>
      </header>
      <ul className="level-grid">
        {BUILT_IN_LEVELS.map((level, i) => {
          const best = bests[level.id];
          return (
            <li key={level.id}>
              <button
                className="level-card"
                onClick={() => {
                  audio.unlock();
                  go({ name: 'play', levelId: level.id, from: 'levels' });
                }}
              >
                <span className="level-number">{i + 1}</span>
                <span className="level-name">{level.name}</span>
                <span className="level-difficulty">{level.difficulty}</span>
                <span className="level-best">
                  {best !== undefined ? `Best ${formatTime(best)}` : 'Not finished yet'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
