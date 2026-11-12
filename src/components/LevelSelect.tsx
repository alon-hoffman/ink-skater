import { useEffect, useState } from 'react';
import { arrowNavigate, useEscape } from '../app/hooks';
import type { Route } from '../app/navigation';
import { audio, repositories } from '../app/services';
import { formatTime } from '../game/Game';
import { BUILT_IN_LEVELS } from '../levels/builtInLevels';
import type { Level } from '../levels/levelTypes';
import { formatLimit, knownProgress } from '../levels/objectives';
import type { LevelProgress } from '../levels/objectives';
import { WORLDS, isWorldUnlocked } from '../levels/worlds';
import type { World } from '../levels/worlds';

function levelsOf(world: World): Level[] {
  return world.levelIds.flatMap((id) => BUILT_IN_LEVELS.find((l) => l.id === id) ?? []);
}

function Check({ done, label }: { done: boolean; label: string }): React.JSX.Element {
  return (
    <li className={done ? 'obj-row earned' : 'obj-row'}>
      <span className={done ? 'obj-box done' : 'obj-box'} aria-hidden="true" />
      <span className="obj-label">{label}</span>
      <span className="sr-only">{done ? '(done)' : '(not done)'}</span>
    </li>
  );
}

export function LevelSelect(props: {
  go: (route: Route) => void;
  worldId?: string | undefined;
}): React.JSX.Element {
  const { go } = props;
  const [worldId, setWorldId] = useState<string | null>(props.worldId ?? null);
  const [bests, setBests] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all([repositories.records.getAllBests(), repositories.progress.getAll()]).then(
      ([b, p]) => {
        if (!alive) return;
        setBests(b);
        setProgress(p);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  /** A level counts as finished if it has a best time (older saves) or a saved finish. */
  const finished = new Set<string>();
  for (const level of BUILT_IN_LEVELS) {
    if (bests[level.id] !== undefined || progress[level.id]?.finish) finished.add(level.id);
  }

  const world = WORLDS.find((w) => w.id === worldId) ?? null;
  useEscape(() => (world ? setWorldId(null) : go({ name: 'menu' })));

  if (world) {
    const levels = levelsOf(world);
    return (
      <main className="screen world-screen" data-paper={world.paper}>
        <header className="screen-header">
          <button className="btn small" onClick={() => setWorldId(null)} title="Back (Esc)">
            ← Worlds
          </button>
          <h2>
            {world.name}
            <span className="world-theme"> · {world.theme}</span>
          </h2>
        </header>
        <ul className="level-grid" onKeyDown={(e) => arrowNavigate(e, '.level-card')}>
          {levels.map((level, i) => {
            const best = bests[level.id];
            const p = knownProgress(level.objectives, best, progress[level.id]);
            const objectives = level.objectives;
            return (
              <li key={level.id}>
                <button
                  className="level-card"
                  autoFocus={i === 0}
                  onClick={() => {
                    audio.unlock();
                    go({ name: 'play', levelId: level.id, from: 'levels' });
                  }}
                >
                  <span className="level-number">{i + 1}</span>
                  <span className="level-name">{level.name}</span>
                  <span className="level-difficulty">{level.difficulty}</span>
                  <ul className="objective-list compact" aria-label="Objectives">
                    <Check done={finished.has(level.id)} label="Reach the flag" />
                    {objectives && (
                      <>
                        <Check
                          done={p?.time ?? false}
                          label={`Under ${formatLimit(objectives.timeLimit)}`}
                        />
                        <Check
                          done={p?.score ?? false}
                          label={`${objectives.scoreTarget}+ points`}
                        />
                      </>
                    )}
                  </ul>
                  <span className="level-best">
                    {best !== undefined ? `Best ${formatTime(best)}` : 'Not finished yet'}
                    {p && p.bestScore > 0 ? ` · Top score ${p.bestScore}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <button className="btn small" onClick={() => go({ name: 'menu' })} title="Back (Esc)">
          ← Menu
        </button>
        <h2>Choose a world</h2>
      </header>
      <ul className="world-grid" onKeyDown={(e) => arrowNavigate(e, '.world-card')}>
        {WORLDS.map((w, i) => {
          const unlocked = isWorldUnlocked(i, finished);
          const levels = levelsOf(w);
          const done = levels.filter((l) => finished.has(l.id)).length;
          const checks = levels.reduce((n, l) => {
            const p = knownProgress(l.objectives, bests[l.id], progress[l.id]);
            return n + (finished.has(l.id) ? 1 : 0) + (p?.time ? 1 : 0) + (p?.score ? 1 : 0);
          }, 0);
          const prev = WORLDS[i - 1];
          const prevFinale = prev
            ? BUILT_IN_LEVELS.find((l) => l.id === prev.levelIds.at(-1))
            : null;
          return (
            <li key={w.id}>
              <button
                className="world-card"
                data-paper={w.paper}
                disabled={!unlocked}
                autoFocus={i === 0}
                onClick={() => {
                  audio.unlock();
                  audio.click();
                  setWorldId(w.id);
                }}
              >
                <span className="world-number">World {i + 1}</span>
                <span className="world-name">{w.name}</span>
                <span className="world-theme-line">{w.theme}</span>
                <span className="world-blurb">{w.blurb}</span>
                <span className="world-progress">
                  {unlocked
                    ? `${done} of ${levels.length} finished · ${checks} of ${levels.length * 3} objectives`
                    : `🔒 Finish ${prevFinale?.name ?? 'the last level'} in ${prev?.name ?? 'the previous world'} to open`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
