import { InputState } from './InputState';
import type { InputSample, Zone } from './InputState';

export interface InputCallbacks {
  onRestart: () => void;
  onPauseToggle: () => void;
  /** Fired on any user input so audio can be unlocked. */
  onGesture?: () => void;
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space']);

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
    const down = (e: PointerEvent): void => {
      e.preventDefault();
      this.callbacks.onGesture?.();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture can fail for synthetic pointers; tracking by id still works */
      }
      if (!this.locked) this.state.pointerDown(e.pointerId, zone);
    };
    const up = (e: PointerEvent): void => {
      e.preventDefault();
      this.state.pointerUp(e.pointerId);
    };
    const block = (e: Event): void => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', block);
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down);
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
    return this.locked ? { tilt: 0, crouch: false } : this.state.sample();
  }

  detach(): void {
    for (const c of this.cleanups.splice(0)) c();
    this.state.reset();
  }
}
