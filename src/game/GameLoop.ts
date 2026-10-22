import { PHYSICS } from './physicsConfig';

export interface GameLoopCallbacks {
  /** Advance exactly one fixed physics tick. */
  step: () => void;
  /** Draw; `alpha` is 0..1 progress between the last two ticks; `dt` is wall-clock seconds. */
  render: (alpha: number, dt: number) => void;
}

/**
 * Fixed-timestep accumulator driven by requestAnimationFrame.
 * Gameplay advances in exact 1/60 s steps regardless of display refresh rate,
 * and catch-up after a stall is capped so a frozen tab cannot spiral.
 */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private accumulator = 0;
  private running = false;
  /** When true, ticks are skipped (but rendering continues). */
  stepping = true;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Drop accumulated time (used when unpausing or after a reset). */
  resetClock(): void {
    this.last = performance.now();
    this.accumulator = 0;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const step = PHYSICS.stepSeconds;
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    if (this.stepping) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= step && steps < PHYSICS.maxCatchUpSteps) {
        this.callbacks.step();
        this.accumulator -= step;
        steps++;
      }
      if (steps === PHYSICS.maxCatchUpSteps) this.accumulator = 0;
    } else {
      this.accumulator = 0;
    }
    const alpha = this.stepping ? this.accumulator / step : 1;
    this.callbacks.render(alpha, dt);
    this.raf = requestAnimationFrame(this.frame);
  };
}
