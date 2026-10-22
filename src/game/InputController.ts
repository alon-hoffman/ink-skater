import { InputState } from './InputState';
import type { InputSample, Zone } from './InputState';

export interface InputCallbacks {
  onRestart: () => void;
  onPauseToggle: () => void;
  /** Fired on any user input so audio can be unlocked. */
  onGesture?: () => void;
}

const GAME_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowDown',
  'KeyA',
  'KeyD',
  'KeyS',
  'Space',
]);

/** A touch drag counts as a flip swipe past this horizontal distance (px) when mostly horizontal. */
const SWIPE_MIN_DISTANCE = 50;

/** DOM binding around the pure `InputState`: keyboard, multi-touch zones, focus loss. */
export class InputController {
  readonly state = new InputState();
  private readonly cleanups: Array<() => void> = [];
  /** While true, gameplay input is ignored and not accumulated (paused / finished). */
  locked = false;

  constructor(private readonly callbacks: InputCallbacks) {}

  attach(): void {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.callbacks.onGesture?.();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        this.callbacks.onPauseToggle();
        return;
      }
      if (e.code === 'KeyR') {
        this.callbacks.onRestart();
        return;
      }
      if (!this.locked) this.state.keyDown(e.code);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.state.keyUp(e.code);
    };
    const reset = (): void => this.state.reset();
    const onVisibility = (): void => {
      if (document.hidden) this.state.reset();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('blur', reset),
      () => document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  /** Bind a touch zone element; each pointer is tracked by id so fingers stay independent. */
  attachZone(el: HTMLElement, zone: Zone): void {
    const starts = new Map<number, { x: number; y: number }>();
    const down = (e: PointerEvent): void => {
      e.preventDefault();
      this.callbacks.onGesture?.();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture can fail for synthetic pointers; tracking by id still works */
      }
      if (this.locked) return;
      starts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.state.pointerDown(e.pointerId, zone);
    };
    const move = (e: PointerEvent): void => {
      const start = starts.get(e.pointerId);
      if (!start || this.locked) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      // A swipe flips once and releases this finger so it stops tilting.
      starts.delete(e.pointerId);
      this.state.pointerUp(e.pointerId);
      this.state.requestFlip();
    };
    const up = (e: PointerEvent): void => {
      e.preventDefault();
      starts.delete(e.pointerId);
      this.state.pointerUp(e.pointerId);
    };
    const block = (e: Event): void => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', block);
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
      el.removeEventListener('contextmenu', block);
    });
  }

  reset(): void {
    this.state.reset();
  }

  sample(): InputSample {
    return this.locked ? { tilt: 0, crouch: false, flip: false } : this.state.sample();
  }

  detach(): void {
    for (const c of this.cleanups.splice(0)) c();
    this.state.reset();
  }
}
