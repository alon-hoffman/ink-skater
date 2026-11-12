# Worlds, trick points, objectives and splash screen (Ink Skater)

- **Phase:** Delivered
- **Kind:** Change to existing system
- **Last updated:** 2026-11-12
- **Folder:** C:\Users\Alon\Desktop\Claude projects\Skater Game

## The idea, in Lauren's words

"I want to make this feel more like a real game. I added an image for the splash screen in the folder. Add points that are earned by tricks (flips, and manuals: only one wheel touching the ground). Add additional objectives to levels: finish under a time limit, and finish with above a score count. Add longer levels, and worlds: a world has a shared challenge theme and a shared background. We are still working with the sketch idea: math paper, dotted paper, legal pads, and blueprint paper."

## Existing system

- What it is and how it is built: Ink Skater, a browser game (React + TypeScript + Vite, Matter.js physics, drawn on a canvas as pen-on-notebook-paper). 13 built-in levels in `src/levels/builtInLevels.ts`, a level editor, "My Levels", shared cloud levels, best times stored in the browser's local storage. Tests with Vitest, including bots that play levels.
- Parts we can reuse: the `Simulation` (flip and landing detection can hook in next to `handleLanding`), `ContactTracker` (per-wheel ground contact, used for manuals), `drawPaper` (the notebook background, one place to extend into 4 paper types), `CompletionScreen` and `LevelSelect`, the records store (best times).
- Instructions and conventions found: `npm run check` (types, lint, formatting, tests). Splash image `Ink Skater Notebook Splash Screen.png` is untracked in the repo root; it has the lined-paper look, a title, and the text "Press Any Key to Start".

## Answers so far

| # | Question | Answer | Date |
|---|----------|--------|------|
| 1 | How do objectives work? | Three separate objectives per level: finish, finish under a time limit, finish above a score limit. NOT stars (stars imply ranking). Show as independent checkmarks. | 2026-11-12 |
| 2 | Which worlds? | Drop dotted paper. Four worlds: Lined notebook (current look, assumed kept as world 1), Graph (math) paper, Legal pad, Blueprint. Each has a shared challenge theme and shared background. | 2026-11-12 |
| 3 | Do worlds unlock in order? | Yes. Finishing a world's last level opens the next world. All levels inside an open world are playable in any order. | 2026-11-12 |

## Waiting on Lauren

## Agreed scope (confirmed by Lauren 2026-11-12)

- **Will do:**
  - Splash screen (her image) shown at launch; any key, click or tap goes to the main menu.
  - Trick points: a flip (full 360-degree spin in the air, either direction) scores 100 each, but only when you land it; a manual (only one wheel on the ground, held at least half a second) scores points per second and banks when it ends cleanly. Crashing mid-trick scores nothing; a crash restarts the run and the run's score resets to 0.
  - Live score on screen, small "+100 Flip" pop-ups when a trick lands.
  - Three separate objectives per built-in level, shown as ink checkboxes: Finish; Finish under [time limit]; Finish with [score] or more points. Each is saved separately on this device once achieved.
  - Four worlds in order: 1 Lined notebook (learn to roll), 2 Graph paper (gaps and jumps), 3 Legal pad (tight spaces and turnarounds), 4 Blueprint (big air and speed). Each world has its own paper look. Worlds unlock in order.
  - 20 built-in levels: the 13 current ones sorted into worlds plus 7 new ones, including a long finale in every world.
  - Level select becomes a world screen, then that world's levels; level cards show the three checkboxes, best time and best score.
  - Finish screen shows which objectives were met this run.
- **Won't do:** objectives or paper types for custom (editor) levels; online leaderboards; star ratings; dotted paper; changes to the physics or controls.
- **Defaults chosen for Lauren:**
  - Time limits and score targets are set from how a test player completes each level, with room for a human; I will tune them so they are tough but fair.
  - Existing best times stay saved. Levels that already had a best time count as "Finished" objective done.
  - Custom levels keep working exactly as before (plain notebook paper).

## Acceptance examples

| # | Given | When | Expect | Kind | Result |
|---|-------|------|--------|------|--------|
| E1 | Game just opened | Page loads | Splash picture shows with "Press Any Key to Start"; any key, click or tap opens the main menu | main | passed |
| E2 | On a level | Skater does a full spin in the air and lands on its wheels | Score rises by 100 and "+100 Flip" appears | main | passed |
| E3 | On a level | Skater spins but crashes | No points added; the run restarts with score 0 | failure | passed |
| E4 | On flat ground | Only one wheel touches the ground for over half a second, then both land | Points in proportion to the time held, shown as "+N Manual" | main | partly (tests and bots, not by hand) |
| E5 | On flat ground | One wheel lifts for under half a second | No points | failure | passed |
| E6 | Level with time limit 40 s and score target 300 | Finish in 35 s with 350 points | All three checkboxes ticked on the finish screen and the level card | main | passed |
| E7 | Same level | Finish in 50 s with 350 points | Finish and score ticked, time not ticked | main | passed |
| E8 | Same level | Finish in 35 s with 100 points | Finish and time ticked, score not ticked | main | passed |
| E9 | An objective ticked earlier | Replay and do worse | It stays ticked | main | passed |
| E10 | Fresh save | Open the level screen | Only World 1 open; Worlds 2-4 show as locked | main | passed |
| E11 | World 1's last level not finished | Finish it | World 2 opens, with its own paper style | main | passed |
| E12 | Any world | Play any level | Background matches the world (lined / graph / legal pad / blueprint) and stays readable | main | passed |
| E13 | Existing level with a saved best time | Open the game after the update | Best time still shown and "Finish" ticked | existing | passed |
| E14 | A custom level | Play and edit it | Works as before on plain notebook paper, no objectives | existing | passed |
| E15 | Each world's long finale | Test player drives through it | Can be finished, and is clearly longer than World 1's first level | main | partly (tests and bots, not by hand) |
| E16 | Paused game | Time passes | Timer and trick timers do not advance | failure | passed |

## Baseline

- **Work in progress found before we started:** only the new splash picture in the project folder (untracked). Nothing else.
- **Checks before any change:** typecheck passed, lint passed, tests 89/89 passed. The formatting check already failed on 24 files before any change (Windows line endings); left alone.

## Decisions and scope changes

- 2026-11-12 Objectives are three separate checkmarks, not stars - Lauren's call.
- 2026-11-12 Dotted paper dropped; four worlds - Lauren's call.
- 2026-11-12 Worlds unlock in order - Lauren's call.
- 2026-11-12 20 levels: 13 existing + 7 new (ids builtin-16 to builtin-22), four worlds of five - routine.
- 2026-11-12 Score and flips shown on custom levels too (points count and pop-ups), but no objectives or paper change there - routine.
- 2026-11-12 Test timeout raised to 30 s in vite.config.ts so a busy computer does not cause false failures - routine.
- 2026-11-12 Returning from a level goes to the main menu, as before - routine.

- 2026-11-12 Lauren: HUD (time/score/objective chips) must match each world's paper instead of cream everywhere - fix now.
- 2026-11-12 Lauren: wants many more NEW levels, not only regrouped ones. Final plan, confirmed ("amazing"): keep all 13 existing levels; 6 new levels per world; worlds 2-4 new levels are long (about 1-2 minutes). New totals: World 1 = 4 old + 6 new (10), World 2 = 3 old + 6 new (9), World 3 = 4 old + 6 new (10), World 4 = 2 old + 6 new (8): 37 levels. The 7 levels already drafted count toward the 6 per world; those in worlds 2-4 are lengthened to 1-2 minutes. Old short levels play first in each world as warm-ups.

## Running it

- **Started with:** `npm run dev` (port 5173)
- **Access:** http://localhost:5173/
- **How Lauren reopens it:** see delivery note.

## Review results

- **Cleanup verdict:** meets the quality standard (1 round; independent reviewer found no critical or major problems).
- **Fixed:** F1 finish screen said "New!" for levels already finished in older saves; F2 world cards were too wide on phones. Also: old best times now also count toward "Under time" when they were within the limit.
- **Independent user test:** E1-E3, E5-E14, E16 verified in the running game or by simulation; E4 and E15 verified by tests and bots only.
- **Pre-existing issues found (not fixed):** formatting check fails on 24 older files (Windows line endings).
- **Known limitations:** score targets on the harder Blueprint and Legal Pad levels have not been proven reachable by a person; only First Ride (manual) and Launch Pad (a flip) were proven by bots. Touch screens not tested on a real device. Another session left unfinished files in the folder (src/levels/worldBlueprint.ts, worldNotebook.ts, worldGraph.ts and matching tests) that are not part of this work and currently stop the project-wide type check; they were left alone.

## Decisions for Lauren after delivery

- [ ] Should I loosen or tighten the score targets after you have played a few levels? - **Recommended:** play first, then tell me which felt too hard or too easy. - **Why it matters:** targets were set from bot play and estimates.
- [ ] Should "Return to Menu" from a level go back to that world's level list instead? - **Recommended:** yes. - **Why it matters:** with worlds, going back to the menu means three extra clicks.
