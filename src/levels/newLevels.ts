import type { Level } from './levelTypes';
import { longHaul } from './newLevelsLinedGraph';
import { blueprintLevels } from './worldBlueprint';
import { graphLevels } from './worldGraph';
import { legalLevels } from './worldLegal';
import { notebookLevels } from './worldNotebook';

/** The levels added with the worlds update, gathered from each world's file. */
export const NEW_LEVELS: readonly Level[] = [
  longHaul(),
  ...graphLevels(),
  ...legalLevels(),
  ...notebookLevels(),
  ...blueprintLevels(),
];
