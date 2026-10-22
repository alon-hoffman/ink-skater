import { useEffect, useState } from 'react';

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
