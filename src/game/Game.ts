import type { Level } from '../levels/levelTypes';
import type { AudioManager } from './AudioManager';
import { Camera } from './Camera';
import type { CameraTarget } from './Camera';
import { Effects } from './Effects';
import { GameLoop } from './GameLoop';
import { GameRenderer } from './GameRenderer';
import { InputController } from './InputController';
import { PHYSICS } from './physicsConfig';
import { Simulation } from './Simulation';

export interface GameOptions {
  canvas: HTMLCanvasElement;
  level: Level;
  audio: AudioManager;
  /** Called once per completion with the finish time in seconds. */
  onComplete: (time: number) => void;
  onPauseChange: (paused: boolean) => void;
  /** HUD elements are updated imperatively so physics never triggers React renders. */
  hud?: { time?: HTMLElement | null; charge?: HTMLElement | null };
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Owns one running level: simulation, loop, camera, input and canvas. Lives outside React. */
export class Game {
  private readonly sim: Simulation;
  private readonly camera = new Camera();
  private readonly effects = new Effects();
  private readonly renderer: GameRenderer;
  private readonly input: InputController;
  private readonly loop: GameLoop;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private paused = false;
  private completed = false;
  private destroyed = false;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private clock = 0;
  private flash = 0;
  private lastTimeText = '';
  private lastCharge = -1;

  constructor(private readonly options: GameOptions) {
    const { canvas, level, audio } = options;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.sim = new Simulation(level, {
      onJump: (charge) => audio.jump(charge),
      onLand: (impact) => {
        audio.land(impact);
        const board = this.sim.skateboard.board.position;
        this.effects.dust({ x: board.x, y: board.y + 22 }, impact);
      },
      onDeath: () => {
        audio.crash();
        this.flash = PHYSICS.deathFlashSeconds;
        const head = this.sim.headWorld();
        this.effects.crash(head);
      },
      onVictory: (time) => {
        this.completed = true;
        audio.victory();
        audio.silenceRolling();
        this.effects.celebrate(level.flag);
        options.onComplete(time);
      },
    });
    this.renderer = new GameRenderer(level);
    this.input = new InputController({
      onRestart: () => this.restart(),
      onPauseToggle: () => (this.paused ? this.resume() : this.pause()),
      onGesture: () => audio.unlock(),
    });
    this.input.attach();
    this.loop = new GameLoop({
      step: () => this.tick(),
      render: (alpha, dt) => this.draw(alpha, dt),
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.snapCamera();
    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = this;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
  }

  start(): void {
    this.loop.start();
  }

  attachTouchZones(left: HTMLElement, right: HTMLElement): void {
    this.input.attachZone(left, 'left');
    this.input.attachZone(right, 'right');
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isCompleted(): boolean {
    return this.completed;
  }

  pause(): void {
    if (this.paused || this.completed || this.destroyed) return;
    this.paused = true;
    this.input.locked = true;
    this.input.reset();
    this.loop.stepping = false;
    this.options.audio.silenceRolling();
    this.options.onPauseChange(true);
  }

  resume(): void {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    this.input.locked = this.completed;
    this.input.reset();
    this.loop.resetClock();
    this.loop.stepping = !this.completed;
    this.options.onPauseChange(false);
  }

  /** Full clean restart: simulation, controls, camera, timer, effects. */
  restart(): void {
    if (this.destroyed) return;
    const wasPaused = this.paused;
    this.paused = false;
    this.completed = false;
    this.input.locked = false;
    this.input.reset();
    this.sim.restart();
    this.effects.clear();
    this.flash = 0;
    this.snapCamera();
    this.loop.stepping = true;
    this.loop.resetClock();
    if (wasPaused) this.options.onPauseChange(false);
  }

  private snapCamera(): void {
    this.camera.snapTo(this.cameraTarget());
  }

  private cameraTarget(): CameraTarget {
    const board = this.sim.skateboard.board.position;
    const v = this.sim.skateboard.velocity();
    return {
      position: { x: board.x, y: board.y },
      velocity: { x: v.x / PHYSICS.stepSeconds, y: v.y / PHYSICS.stepSeconds },
      facing: this.sim.facing,
    };
  }

  private tick(): void {
    if (this.paused || this.completed) return;
    const deathsBefore = this.sim.deaths;
    this.sim.step(this.input.sample());
    // The sim resets itself on death; recentre the camera on the spawn.
    if (this.sim.deaths !== deathsBefore) this.snapCamera();
    else this.camera.update(PHYSICS.stepSeconds, this.cameraTarget());
    this.effects.update(PHYSICS.stepSeconds);
  }

  private draw(alpha: number, dt: number): void {
    if (this.destroyed) return;
    this.clock += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.completed || this.paused) this.effects.update(this.paused ? 0 : dt);
    const view = this.camera.interpolated(alpha);
    this.renderer.render(this.ctx, this.sim, this.effects, {
      w: this.cssW,
      h: this.cssH,
      dpr: this.dpr,
      view,
      alpha,
      clock: this.clock,
      flash: this.flash / PHYSICS.deathFlashSeconds,
      speedLines: this.clock,
    });
    this.options.audio.setRolling(
      this.sim.speed,
      this.sim.grounded && !this.paused && !this.completed,
    );
    this.updateHud();
  }

  private updateHud(): void {
    const { time, charge } = this.options.hud ?? {};
    if (time) {
      const text = formatTime(this.sim.time);
      if (text !== this.lastTimeText) {
        time.textContent = text;
        this.lastTimeText = text;
      }
    }
    if (charge) {
      const value = Math.round(this.sim.jump.charge01 * 100);
      if (value !== this.lastCharge) {
        charge.style.transform = `scaleX(${value / 100})`;
        this.lastCharge = value;
      }
    }
  }

  private resize(): void {
    const { canvas } = this.options;
    const rect = canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(this.cssW * this.dpr);
    canvas.height = Math.round(this.cssH * this.dpr);
    this.camera.setViewport(this.cssW, this.cssH);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.pause();
  };

  private readonly onBlur = (): void => {
    this.input.reset();
  };

  /** Test/diagnostic access to simulation state. */
  get simulation(): Simulation {
    return this.sim;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.detach();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.options.audio.silenceRolling();
    this.sim.dispose();
    this.effects.clear();
  }
}
