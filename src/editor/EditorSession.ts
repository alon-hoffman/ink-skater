import type { Level, LevelContent } from '../levels/levelTypes';
import {
  applyContentEdit,
  contentOf,
  recordValidation,
  renameLevel,
} from '../levels/levelValidation';
import { History } from './editorCommands';

type Listener = () => void;

/**
 * Framework-free editor document: the level being edited, its undo history, selection and dirty flag.
 * React subscribes via `subscribe`/`version`; the canvas controller calls the mutating methods.
 */
export class EditorSession {
  private _level: Level;
  private readonly history: History<LevelContent>;
  private _selectedId: string | null = null;
  private _dirty: boolean;
  private _version = 0;
  private readonly listeners = new Set<Listener>();

  constructor(
    level: Level,
    private readonly clock: () => number = Date.now,
    dirty = false,
  ) {
    this._level = level;
    this.history = new History(contentOf(level));
    this._dirty = dirty;
  }

  get level(): Level {
    return this._level;
  }

  get content(): LevelContent {
    return this.history.present;
  }

  get selectedId(): string | null {
    return this._selectedId;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** Monotonic counter for useSyncExternalStore. */
  get version(): number {
    return this._version;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this._version;

  private emit(): void {
    this._version++;
    for (const l of [...this.listeners]) l();
  }

  /** Commit an edit to the history and bump the level revision (which invalidates validation). */
  edit(next: LevelContent): void {
    if (!this.history.commit(next)) return;
    this._level = applyContentEdit(this._level, next, this.clock());
    this._dirty = true;
    this.dropMissingSelection();
    this.emit();
  }

  undo(): void {
    const prev = this.history.undo();
    if (!prev) return;
    this._level = applyContentEdit(this._level, prev, this.clock());
    this._dirty = true;
    this.dropMissingSelection();
    this.emit();
  }

  redo(): void {
    const next = this.history.redo();
    if (!next) return;
    this._level = applyContentEdit(this._level, next, this.clock());
    this._dirty = true;
    this.dropMissingSelection();
    this.emit();
  }

  select(id: string | null): void {
    if (this._selectedId === id) return;
    this._selectedId = id;
    this.emit();
  }

  rename(name: string): void {
    const next = renameLevel(this._level, name, this.clock());
    if (next === this._level) return;
    this._level = next;
    this._dirty = true;
    this.emit();
  }

  /** Called when a playtest finishes the level at `revision`. A stale revision is ignored. */
  validate(args: { revision: number; time: number }): boolean {
    const next = recordValidation(this._level, { ...args, at: this.clock() });
    if (next === this._level) return false;
    this._level = next;
    this._dirty = true;
    this.emit();
    return true;
  }

  markSaved(): void {
    this._dirty = false;
    this.emit();
  }

  private dropMissingSelection(): void {
    if (this._selectedId && !this.history.present.strokes.some((s) => s.id === this._selectedId)) {
      this._selectedId = null;
    }
  }
}
