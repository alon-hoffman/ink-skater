import { useState } from 'react';
import { GameScreen } from '../components/GameScreen';
import { LevelSelect } from '../components/LevelSelect';
import { MainMenu } from '../components/MainMenu';
import { MyLevels } from '../components/MyLevels';
import { Editor } from '../editor/Editor';
import { BUILT_IN_LEVELS, getBuiltInLevel } from '../levels/builtInLevels';
import type { Level } from '../levels/levelTypes';
import { MENU } from './navigation';
import type { Route } from './navigation';
import { repositories } from './services';
import { useEffect } from 'react';

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(MENU);

  switch (route.name) {
    case 'menu':
      return <MainMenu go={setRoute} />;
    case 'levels':
      return <LevelSelect go={setRoute} />;
    case 'myLevels':
      return <MyLevels go={setRoute} />;
    case 'editor':
      return (
        <Editor
          key={`${route.levelId ?? 'new'}-${route.fresh ? 'fresh' : 'resume'}`}
          levelId={route.levelId}
          fresh={route.fresh}
          onExit={() => setRoute(MENU)}
        />
      );
    case 'play':
      return <PlayRoute route={route} go={setRoute} />;
  }
}

function PlayRoute(props: {
  route: Extract<Route, { name: 'play' }>;
  go: (route: Route) => void;
}): React.JSX.Element {
  const { route, go } = props;
  const builtIn = getBuiltInLevel(route.levelId);
  const [custom, setCustom] = useState<Level | null | 'loading'>(builtIn ? null : 'loading');

  useEffect(() => {
    if (builtIn) return;
    let alive = true;
    void repositories.levels.get(route.levelId).then((l) => {
      if (alive) setCustom(l);
    });
    return () => {
      alive = false;
    };
  }, [builtIn, route.levelId]);

  const level = builtIn ?? (custom === 'loading' ? null : custom);
  if (custom === 'loading' && !builtIn) {
    return (
      <main className="screen">
        <p className="muted">Loading…</p>
      </main>
    );
  }
  if (!level) {
    return (
      <main className="screen">
        <p>That level could not be found.</p>
        <button className="btn" onClick={() => go({ name: route.from })}>
          Back
        </button>
      </main>
    );
  }
  const index = BUILT_IN_LEVELS.findIndex((l) => l.id === level.id);
  const next = index >= 0 ? BUILT_IN_LEVELS[index + 1] : undefined;
  return (
    <GameScreen
      key={level.id}
      level={level}
      mode="play"
      onExit={() => go({ name: 'menu' })}
      onNext={next ? () => go({ name: 'play', levelId: next.id, from: route.from }) : undefined}
    />
  );
}
