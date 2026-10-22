# Ink Skater

A 2D side-scrolling skateboard physics game drawn like a black-pen sketch on notebook paper, with five hand-built levels and a full level editor. React + TypeScript + Vite, Matter.js physics, Canvas 2D rendering, Web Audio sound, localStorage persistence. No backend and no external assets.

## Prerequisites

- Node.js 20+ and npm

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. `npm run build` creates a production build in `dist/` and `npm run preview` serves it.

## Controls

| Action                            | Keyboard                         | Touch (landscape)      |
| --------------------------------- | -------------------------------- | ---------------------- |
| Tilt counterclockwise / clockwise | Left / Right arrow or A / D      | Hold left / right half |
| Crouch and charge a jump          | Hold both directions, or Space   | Hold both halves       |
| Jump                              | Release one direction (or Space) | Lift one finger        |
| Restart / pause                   | R / Esc                          | On-screen buttons      |

The board rolls forward by itself. Hold tilt on the ground for wheelies and manuals; in the air spin is kept until you counter it. Only your head touching terrain (or falling out of the level) is fatal.

Editor shortcuts: D draw, V select, M move, H pan (or hold Space), S spawn, F flag, Del delete, Ctrl+Z / Ctrl+Shift+Z undo/redo, mouse wheel or pinch to zoom.

## Scripts

| Script                            | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `npm run dev`                     | Vite dev server                         |
| `npm run build`                   | Typecheck then production build         |
| `npm run typecheck`               | `tsc -b --noEmit`                       |
| `npm run lint` / `lint:fix`       | ESLint (flat config, type-aware)        |
| `npm run format` / `format:check` | Prettier                                |
| `npm test` / `npm run test:run`   | Vitest watch / single run               |
| `npm run check`                   | typecheck + lint + format check + tests |

## Architecture

```
src/
  app/         App shell, routes, service singletons (repositories, audio)
  components/  Menus, level select, My Levels, game screen, pause and completion overlays
  editor/      EditorSession (document + undo), pure commands, canvas, pointer controller, React shell
  game/        Simulation (headless physics + rules), Game (DOM wrapper), loop, camera, input, audio, drawing
  levels/      Level types, geometry, built-in levels, validation, serialization, repositories
  styles/      Notebook theme
tests/         Vitest suites, including an autopilot that finishes every built-in level
```

- `Simulation` has no DOM or React dependency. It runs a fixed 1/60 s tick (4 Matter sub-steps) and is driven by `GameLoop` with interpolated rendering and a capped catch-up.
- Terrain strokes become smooth Catmull-Rom curves; rendering and collision share one curve (`strokeGeometry`). Collision is overlapping thin rectangles, streamed in by column near the skater.
- The skateboard is a deck plus two polygon wheels pinned with constraints. Per-wheel contacts come from real Matter collision pairs. The head is a sensor circle synced to the animated pose.
- Levels use one format for built-in and custom levels. Validation stores the validated revision; any gameplay edit bumps the revision and so invalidates it.
- Persistence goes through repository interfaces (`levels/levelRepository.ts`); `localLevelRepository.ts` is the localStorage implementation.

## Tuning notes

All physics constants live in `src/game/physicsConfig.ts`. Two deliberate assists are documented there: a slightly negative rolling resistance (it cancels energy the solver bleeds from a rolling wheel) and a grip force on walls and ceilings so inverted riding works at reasonable speeds.
