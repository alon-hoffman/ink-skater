import { useEffect, useRef, useState } from 'react';
import { arrowNavigate, useEscape } from '../app/hooks';
import { MENU } from '../app/navigation';
import type { Route } from '../app/navigation';

export const TUTORIAL_SEEN_KEY = 'inkskater.tutorialSeen.v1';

/** Unreadable storage counts as seen, so a blocked browser is not nagged on every launch. */
export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    /* storage blocked: the tutorial stays reachable from the menu */
  }
}

interface Step {
  title: string;
  art: React.JSX.Element;
  body: React.JSX.Element;
}

const STEPS: Step[] = [
  {
    title: 'The goal',
    art: (
      <svg viewBox="0 0 240 120" className="tut-art-svg" aria-hidden="true">
        <path className="tut-ink" d="M8 92 C 50 92, 70 80, 110 84 S 170 100, 232 84" />
        <path className="tut-trail" d="M70 60 Q 130 -6 186 32" />
        <path className="tut-ink" d="M196 86 L196 30" />
        <path className="tut-flag" d="M196 30 L224 39 L196 48 Z" />
        <circle className="tut-ink" cx="66" cy="46" r="7" />
        <path className="tut-ink" d="M66 53 L68 68 M66 58 L58 66 M66 58 L76 62" />
        <path className="tut-ink" d="M48 78 L84 78" />
        <circle className="tut-ink" cx="54" cy="81" r="3" />
        <circle className="tut-ink" cx="78" cy="81" r="3" />
      </svg>
    ),
    body: (
      <>
        <p>Ride your skater across the hand-drawn terrain and reach the flag.</p>
        <p>Each clear records your time, and your best time is kept for every level.</p>
      </>
    ),
  },
  {
    title: 'Keyboard controls',
    art: (
      <svg viewBox="0 0 240 120" className="tut-art-svg" aria-hidden="true">
        <rect className="tut-keycap" x="20" y="16" width="120" height="30" rx="6" />
        <text className="tut-label" x="80" y="36">
          Space
        </text>
        <rect className="tut-keycap" x="150" y="16" width="34" height="30" rx="6" />
        <text className="tut-label" x="167" y="36">
          ←
        </text>
        <rect className="tut-keycap" x="190" y="16" width="34" height="30" rx="6" />
        <text className="tut-label" x="207" y="36">
          →
        </text>
        <rect className="tut-keycap" x="20" y="60" width="44" height="30" rx="6" />
        <text className="tut-label" x="42" y="80">
          Z
        </text>
        <rect className="tut-keycap" x="74" y="60" width="44" height="30" rx="6" />
        <text className="tut-label" x="96" y="80">
          R
        </text>
        <rect className="tut-keycap" x="128" y="60" width="44" height="30" rx="6" />
        <text className="tut-label" x="150" y="80">
          Esc
        </text>
        <text className="tut-label tut-caption" x="120" y="112">
          hold Space, release to jump
        </text>
      </svg>
    ),
    body: (
      <ul className="tut-keys">
        <li>
          <kbd className="tut-key">Space</kbd>
          <span>Hold to charge a jump, release to launch. Down or S also charge.</span>
        </li>
        <li>
          <span>
            <kbd className="tut-key">←</kbd> <kbd className="tut-key">→</kbd>
          </span>
          <span>Tilt counterclockwise / clockwise. A and D also work.</span>
        </li>
        <li>
          <kbd className="tut-key">Z</kbd>
          <span>Turn around (flip which way you travel).</span>
        </li>
        <li>
          <kbd className="tut-key">R</kbd>
          <span>Restart the level.</span>
        </li>
        <li>
          <kbd className="tut-key">Esc</kbd>
          <span>Pause or resume.</span>
        </li>
      </ul>
    ),
  },
  {
    title: 'Touch controls',
    art: (
      <svg viewBox="0 0 240 120" className="tut-art-svg" aria-hidden="true">
        <rect className="tut-phone" x="70" y="6" width="100" height="108" rx="12" />
        <path className="tut-ink" d="M70 62 L170 62" />
        <path className="tut-ink tut-dashed" d="M120 62 L120 114" />
        <text className="tut-label" x="95" y="100">
          ↺
        </text>
        <text className="tut-label" x="145" y="100">
          ↻
        </text>
        <path className="tut-trail" d="M88 86 L146 86" />
        <path className="tut-hazard" d="M140 82 L150 86 L140 90" />
        <text className="tut-label" x="120" y="34">
          ❚❚ ↻
        </text>
      </svg>
    ),
    body: (
      <ul className="tut-keys">
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>
            The bottom half of the screen is split in two. Hold the left side to tilt
            counterclockwise, the right side to tilt clockwise.
          </span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>Hold both sides together to charge a jump, then lift to launch.</span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>Swipe sideways across either side to turn around.</span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>Top right: ↻ restarts the level and ❚❚ pauses it.</span>
        </li>
      </ul>
    ),
  },
  {
    title: "Don't hit your head",
    art: (
      <svg viewBox="0 0 240 120" className="tut-art-svg" aria-hidden="true">
        <path className="tut-ink" d="M8 96 L96 96 Q 126 46 156 96 L232 96" />
        <circle className="tut-hazard" cx="126" cy="30" r="9" />
        <path className="tut-hazard" d="M126 39 L126 46" />
        <path className="tut-hazard" d="M104 22 L96 16 M148 22 L156 16" />
        <path className="tut-ink" d="M118 96 L128 96" />
        <text className="tut-label tut-hazard-text" x="186" y="58">
          ✕
        </text>
        <text className="tut-label tut-caption" x="120" y="114">
          a crash resets the run
        </text>
      </svg>
    ),
    body: (
      <>
        <p>
          If the skater&apos;s head touches the terrain, the attempt crashes and resets to the
          start.
        </p>
        <p>Falling out of the level also resets the attempt.</p>
        <p>Tilt before you land, and time your jumps so your head clears bumps and steep slopes.</p>
      </>
    ),
  },
  {
    title: 'Level editor',
    art: (
      <svg viewBox="0 0 240 120" className="tut-art-svg" aria-hidden="true">
        <rect className="tut-frame" x="6" y="6" width="228" height="108" rx="8" />
        <path className="tut-ink" d="M22 84 C 60 84, 80 60, 120 66 S 180 92, 220 70" />
        <circle className="tut-spawn" cx="48" cy="72" r="8" />
        <text className="tut-label" x="48" y="76">
          S
        </text>
        <path className="tut-ink" d="M196 70 L196 30" />
        <path className="tut-flag" d="M196 30 L220 38 L196 46 Z" />
        <path className="tut-trail" d="M60 40 Q 90 20 110 44" />
      </svg>
    ),
    body: (
      <ul className="tut-keys">
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>
            <b>Draw</b> (D): drag on the canvas to draw terrain. <b>Select</b> (V) and <b>Move</b>{' '}
            (M) work on existing strokes. Delete removes one, Ctrl+Z undoes.
          </span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>
            <b>Spawn</b> (S) places the skater and <b>Flag</b> (F) places the goal. Facing flips the
            skater&apos;s starting direction.
          </span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>
            <b>Playtest</b> runs the level as you would play it. Completing it validates that exact
            version. Any later edit clears validation.
          </span>
        </li>
        <li>
          <span className="tut-bullet" aria-hidden="true">
            •
          </span>
          <span>
            <b>Save</b> keeps the level in My Levels. Publishing will require a validated level, but
            publishing is not available yet.
          </span>
        </li>
      </ul>
    ),
  },
];

export function Tutorial({ go }: { go: (route: Route) => void }): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const last = STEPS.length - 1;
  const step = STEPS[index]!;

  const finish = (): void => {
    markTutorialSeen();
    go(MENU);
  };
  useEscape(finish);

  // Move focus to the step title so screen readers and keyboard users follow each step.
  useEffect(() => {
    titleRef.current?.focus();
  }, [index]);

  return (
    <main className="screen tut-screen">
      <header className="screen-header">
        <h2>How to play</h2>
        <span className="muted small">
          Step {index + 1} of {STEPS.length}
        </span>
        <button className="btn small" onClick={finish}>
          Skip
        </button>
      </header>

      <section className="tut-card" aria-label={`How to play: ${step.title}`}>
        <div className="tut-art">{step.art}</div>
        <h3 className="tut-step-title" tabIndex={-1} ref={titleRef}>
          {step.title}
        </h3>
        <div className="tut-body">{step.body}</div>
      </section>

      <nav className="tut-nav" aria-label="Tutorial navigation" onKeyDown={(e) => arrowNavigate(e)}>
        <button
          className="btn"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          ← Back
        </button>
        <div className="tut-dots">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              className="tut-dot"
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        {index < last ? (
          <button className="btn primary" onClick={() => setIndex((i) => Math.min(last, i + 1))}>
            Next →
          </button>
        ) : (
          <button className="btn primary" onClick={finish}>
            Finish
          </button>
        )}
      </nav>
      <p className="muted small tut-hint">Esc exits at any time.</p>
    </main>
  );
}
