import type { Vec2 } from '../levels/levelTypes';
import { EditorCanvas } from './EditorCanvas';
import {
  addStroke,
  deleteStroke,
  moveStroke,
  setFlag,
  setSpawn,
  setSpawnDirection,
} from './editorCommands';
import type { EditorSession } from './EditorSession';
import { createStroke, findStrokeAt } from './strokeProcessing';

export type EditorTool = 'draw' | 'select' | 'move' | 'pan' | 'spawn' | 'flag';

type Gesture =
  | { kind: 'none' }
  | { kind: 'draw'; pointerId: number; points: Vec2[] }
  | { kind: 'move'; pointerId: number; strokeId: string; start: Vec2; offset: Vec2 }
  | { kind: 'place'; pointerId: number; target: 'spawn' | 'flag' }
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'pinch' };

interface PointerInfo {
  x: number;
  y: number;
}

const SELECT_TOLERANCE_PX = 16;

/**
 * Pointer/wheel interaction for the editor canvas.
 * One pointer runs the active tool; a second pointer cancels it and turns the gesture into pinch-zoom + pan,
 * so drawing is never confused with navigation.
 */
export class EditorController {
  readonly canvas: EditorCanvas;
  tool: EditorTool = 'draw';
  private gesture: Gesture = { kind: 'none' };
  private readonly pointers = new Map<number, PointerInfo>();
  private pinchLast: { dist: number; mx: number; my: number } | null = null;
  private frame = 0;
  private needsRender = true;
  private spaceDown = false;
  private placePreview: Vec2 | null = null;
  private readonly cleanups: Array<() => void> = [];
  private disposed = false;

  constructor(
    private readonly el: HTMLCanvasElement,
    private readonly session: EditorSession,
    private readonly onTool?: (tool: EditorTool) => void,
  ) {
    this.canvas = new EditorCanvas(el);
  }

  attach(): void {
    const el = this.el;
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      el.addEventListener(type, handler, options);
      this.cleanups.push(() => el.removeEventListener(type, handler));
    };
    on('pointerdown', this.onPointerDown);
    on('pointermove', this.onPointerMove);
    on('pointerup', this.onPointerUp);
    on('pointercancel', this.onPointerCancel);
    on('lostpointercapture', this.onPointerCancel);
    on('wheel', this.onWheel, { passive: false });
    on('contextmenu', (e) => e.preventDefault());

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return;
      if (e.code === 'Space') {
        this.spaceDown = true;
        e.preventDefault();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) this.session.redo();
        else this.session.undo();
      } else if (mod && e.code === 'KeyY') {
        e.preventDefault();
        this.session.redo();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        this.deleteSelected();
      } else if (!mod) {
        const map: Record<string, EditorTool> = {
          KeyD: 'draw',
          KeyV: 'select',
          KeyM: 'move',
          KeyH: 'pan',
          KeyS: 'spawn',
          KeyF: 'flag',
        };
        const tool = map[e.code];
        if (tool) this.setTool(tool);
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') this.spaceDown = false;
    };
    const onResize = (): void => {
      this.canvas.resize();
      this.requestRender();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    this.cleanups.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('resize', onResize),
      () => observer.disconnect(),
      this.session.subscribe(() => this.requestRender()),
    );
    this.canvas.resize();
    this.canvas.fit(this.session.content);
    this.requestRender();
  }

  detach(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    for (const c of this.cleanups.splice(0)) c();
    this.pointers.clear();
  }

  setTool(tool: EditorTool): void {
    if (this.tool === tool) return;
    this.cancelGesture();
    this.tool = tool;
    this.onTool?.(tool);
    this.requestRender();
  }

  fitView(): void {
    this.canvas.fit(this.session.content);
    this.requestRender();
  }

  zoomBy(factor: number): void {
    this.canvas.zoomAt(this.canvas.width / 2, this.canvas.height / 2, factor);
    this.requestRender();
  }

  deleteSelected(): void {
    const id = this.session.selectedId;
    if (!id) return;
    this.session.edit(deleteStroke(this.session.content, id));
  }

  setSpawnDirection(direction: 1 | -1): void {
    this.session.edit(setSpawnDirection(this.session.content, direction));
  }

  requestRender(): void {
    if (this.disposed) return;
    this.needsRender = true;
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (!this.needsRender || this.disposed) return;
        this.needsRender = false;
        this.draw();
      });
    }
  }

  private draw(): void {
    const g = this.gesture;
    let content = this.session.content;
    if (g.kind === 'place' && this.placePreview) {
      content =
        g.target === 'spawn'
          ? { ...content, spawn: this.placePreview }
          : { ...content, flag: this.placePreview };
    }
    this.canvas.render({
      content,
      selectedId: this.session.selectedId,
      drawing: g.kind === 'draw' ? g.points : null,
      moveOffset: g.kind === 'move' ? g.offset : null,
    });
  }

  private local(e: PointerEvent): PointerInfo {
    const rect = this.el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private world(p: PointerInfo): Vec2 {
    return this.canvas.screenToWorld(p.x, p.y);
  }

  private cancelGesture(): void {
    this.gesture = { kind: 'none' };
    this.pinchLast = null;
    this.placePreview = null;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size >= 2) {
      // Second finger: abandon whatever the first started and navigate instead.
      this.gesture = { kind: 'pinch' };
      this.pinchLast = this.pinchMetrics();
      this.requestRender();
      return;
    }

    const wantsPan = this.tool === 'pan' || e.button === 1 || e.button === 2 || this.spaceDown;
    if (wantsPan) {
      this.gesture = { kind: 'pan', pointerId: e.pointerId, lastX: p.x, lastY: p.y };
      return;
    }
    const w = this.world(p);
    switch (this.tool) {
      case 'draw':
        this.gesture = { kind: 'draw', pointerId: e.pointerId, points: [w] };
        break;
      case 'select':
      case 'move': {
        const tolerance = SELECT_TOLERANCE_PX / this.canvas.view.zoom;
        const hit = findStrokeAt(this.session.content.strokes, w, tolerance);
        if (hit) this.session.select(hit.id);
        else if (this.tool === 'select') this.session.select(null);
        const id = this.session.selectedId;
        const canDrag = this.tool === 'move' ? id !== null : hit !== null;
        if (canDrag && id) {
          this.gesture = {
            kind: 'move',
            pointerId: e.pointerId,
            strokeId: id,
            start: w,
            offset: { x: 0, y: 0 },
          };
        }
        break;
      }
      case 'spawn':
      case 'flag':
        this.gesture = { kind: 'place', pointerId: e.pointerId, target: this.tool };
        this.placePreview = w;
        break;
      default:
        break;
    }
    this.requestRender();
  };

  private pinchMetrics(): { dist: number; mx: number; my: number } | null {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;

    if (g.kind === 'pinch') {
      const now = this.pinchMetrics();
      const last = this.pinchLast;
      if (now && last && last.dist > 0) {
        this.canvas.panByScreen(now.mx - last.mx, now.my - last.my);
        this.canvas.zoomAt(now.mx, now.my, now.dist / last.dist);
        this.pinchLast = now;
        this.requestRender();
      }
      return;
    }
    if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      this.canvas.panByScreen(p.x - g.lastX, p.y - g.lastY);
      g.lastX = p.x;
      g.lastY = p.y;
      this.requestRender();
      return;
    }
    if (g.kind === 'draw' && g.pointerId === e.pointerId) {
      const last = g.points[g.points.length - 1];
      const w = this.world(p);
      const minDist = 2.5 / this.canvas.view.zoom;
      if (!last || Math.hypot(w.x - last.x, w.y - last.y) >= minDist) {
        g.points.push(w);
        this.requestRender();
      }
      return;
    }
    if (g.kind === 'move' && g.pointerId === e.pointerId) {
      const w = this.world(p);
      g.offset = { x: w.x - g.start.x, y: w.y - g.start.y };
      this.requestRender();
      return;
    }
    if (g.kind === 'place' && g.pointerId === e.pointerId) {
      this.placePreview = this.world(p);
      this.requestRender();
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const g = this.gesture;
    this.pointers.delete(e.pointerId);
    if (g.kind === 'pinch') {
      if (this.pointers.size === 0) this.cancelGesture();
      else this.pinchLast = this.pinchMetrics();
      this.requestRender();
      return;
    }
    if (g.kind === 'none' || !('pointerId' in g) || g.pointerId !== e.pointerId) {
      return;
    }
    if (g.kind === 'draw') {
      g.points.push(this.world(this.local(e)));
      const stroke = createStroke(g.points);
      if (stroke) {
        this.session.edit(addStroke(this.session.content, stroke));
        this.session.select(null);
      }
    } else if (g.kind === 'place') {
      const w = this.world(this.local(e));
      const doc = this.session.content;
      this.session.edit(g.target === 'spawn' ? setSpawn(doc, w) : setFlag(doc, w));
    } else if (g.kind === 'move') {
      const d = g.offset;
      if (Math.hypot(d.x, d.y) > 0.5) {
        this.session.edit(moveStroke(this.session.content, g.strokeId, d.x, d.y));
      }
    }
    this.cancelGesture();
    this.requestRender();
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 || this.gesture.kind !== 'pinch') this.cancelGesture();
    this.requestRender();
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.canvas.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    this.requestRender();
  };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
