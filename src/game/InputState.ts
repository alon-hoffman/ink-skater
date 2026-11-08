/** Hold to charge a jump, release to launch. */
export const CROUCH_KEYS: ReadonlySet<string> = new Set(['Space', 'ArrowDown', 'KeyS']);
/** Turn around (flip travel direction). */
export const FLIP_KEY = 'KeyZ';

export type Zone = 'left' | 'right';

export interface InputSample {
  /** -1 = counterclockwise (left), 1 = clockwise (right), 0 = none. */
  tilt: -1 | 0 | 1;
  crouch: boolean;
  /** True for the single sample after a flip was requested (Z / swipe). */
  flip: boolean;
}

/**
 * Pure input model. Keyboard keys and touch pointers both feed it;
 * `sample()` derives tilt and crouch with no DOM dependence.
 */
export class InputState {
  private readonly leftKeys = new Set<string>();
  private readonly rightKeys = new Set<string>();
  /** Held crouch keys (Space, Down, S); releasing the last one launches the jump. */
  private readonly crouchKeys = new Set<string>();
  private flipRequested = false;
  private readonly pointers = new Map<number, Zone>();

  keyDown(code: string): void {
    if (code === 'ArrowLeft' || code === 'KeyA') this.leftKeys.add(code);
    else if (code === 'ArrowRight' || code === 'KeyD') this.rightKeys.add(code);
    else if (CROUCH_KEYS.has(code)) this.crouchKeys.add(code);
    else if (code === FLIP_KEY) this.flipRequested = true;
  }

  keyUp(code: string): void {
    this.leftKeys.delete(code);
    this.rightKeys.delete(code);
    this.crouchKeys.delete(code);
  }

  /** Request a direction flip, applied on the next sample. */
  requestFlip(): void {
    this.flipRequested = true;
  }

  pointerDown(id: number, zone: Zone): void {
    this.pointers.set(id, zone);
  }

  pointerUp(id: number): void {
    this.pointers.delete(id);
  }

  reset(): void {
    this.leftKeys.clear();
    this.rightKeys.clear();
    this.crouchKeys.clear();
    this.flipRequested = false;
    this.pointers.clear();
  }

  private get left(): boolean {
    return this.leftKeys.size > 0 || [...this.pointers.values()].includes('left');
  }

  private get right(): boolean {
    return this.rightKeys.size > 0 || [...this.pointers.values()].includes('right');
  }

  sample(): InputSample {
    const { left, right } = this;
    // Down defines crouch on its own; holding both tilt inputs also crouches.
    const crouch = this.crouchKeys.size > 0 || (left && right);
    const tilt = left && right ? 0 : left ? -1 : right ? 1 : 0;
    const flip = this.flipRequested;
    this.flipRequested = false;
    return { tilt, crouch, flip };
  }
}
