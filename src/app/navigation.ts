export type Route =
  | { name: 'menu' }
  | { name: 'levels' }
  | { name: 'myLevels' }
  | { name: 'play'; levelId: string; from: 'levels' | 'myLevels' }
  | { name: 'editor'; levelId: string | null; fresh: boolean };

export const MENU: Route = { name: 'menu' };
