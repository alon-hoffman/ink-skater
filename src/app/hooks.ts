import { useEffect, useRef, useState } from 'react';

/** Reactive matchMedia, used for the portrait "rotate your device" gate. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = (): void => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 900px)';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
}

/**
 * Modal dialog focus management: moves focus into the dialog on open, traps Tab inside it,
 * calls `onEscape` for Escape, and restores focus to the previously focused element on close.
 */
export function useDialogFocus<T extends HTMLElement>(onEscape?: () => void) {
  const ref = useRef<T>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!root.contains(document.activeElement)) (focusableIn(root)[0] ?? root).focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && escapeRef.current) {
        e.preventDefault();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous && previous.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('main button, .editor button')?.focus();
    };
  }, []);

  return ref;
}

/** Calls `handler` on Escape unless something (e.g. a dialog) already handled it. */
export function useEscape(handler: () => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) ref.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/**
 * Arrow-key navigation between the enabled buttons of a container (level cards, toolbar).
 * Left/Right follow DOM order; Up/Down jump to the nearest item in the row above/below.
 */
export function arrowNavigate(e: React.KeyboardEvent<HTMLElement>, selector = 'button'): void {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (!keys.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)].filter(
    (el) => !(el as HTMLButtonElement).disabled,
  );
  const active = document.activeElement as HTMLElement | null;
  const index = active ? items.indexOf(active) : -1;
  if (index < 0) return;
  let target: HTMLElement | undefined;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    target = items[index + (e.key === 'ArrowRight' ? 1 : -1)];
  } else {
    const from = active!.getBoundingClientRect();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    let best = Infinity;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      const dy = (r.top - from.top) * dir;
      if (dy < from.height / 2) continue;
      const score = dy * 1000 + Math.abs(r.left - from.left);
      if (score < best) {
        best = score;
        target = el;
      }
    }
  }
  e.preventDefault();
  target?.focus();
}
