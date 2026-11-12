export type Route =
  | { name: 'splash' }
  | { name: 'menu' }
  | { name: 'levels'; worldId?: string }
  | { name: 'myLevels' }
  | { name: 'tutorial' }
  | { name: 'play'; levelId: string; from: 'levels' | 'myLevels' }
  | { name: 'editor'; levelId: string | null; fresh: boolean };

export const MENU: Route = { name: 'menu' };
