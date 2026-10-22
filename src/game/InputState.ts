export type Zone = 'left' | 'right';

export interface InputSample {
  /** -1 = counterclockwise (left), 1 = clockwise (right), 0 = none. */
  tilt: -1 | 0 | 1;
  crouch: boolean;
}

/**
 * Pure input model. Keyboard keys and touch pointers both feed it;
 * `sample()` derives tilt and crouch with no DOM dependence.
 */
export class InputState {
  private readonly leftKeys = new Set<string>();
  private readonly rightKeys = new Set<string>();
  private space = false;
  private readonly pointers = new Map<number, Zone>();

  keyDown(code: string): void {
    if (code === 'ArrowLeft' || code === 'KeyA') this.leftKeys.add(code);
    else if (code === 'ArrowRight' || code === 'KeyD') this.rightKeys.add(code);
    else if (code === 'Space') this.space = true;
  }

  keyUp(code: string): void {
    this.leftKeys.delete(code);
    this.rightKeys.delete(code);
    if (code === 'Space') this.space = false;
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
    this.space = false;
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
    // Space takes precedence: it alone defines crouch, arrows only tilt.
    const crouch = this.space || (left && right);
    const tilt = left && right ? 0 : left ? -1 : right ? 1 : 0;
    return { tilt, crouch };
  }
}
