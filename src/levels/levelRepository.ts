import type { Level } from './levelTypes';

/** Persistence contract for custom levels. A remote implementation can replace the local one. */
export interface LevelRepository {
  list(): Promise<Level[]>;
  get(id: string): Promise<Level | null>;
  save(level: Level): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Draft {
  level: Level;
  savedAt: number;
}

/** Autosaved, possibly unsaved editor state, kept apart from explicitly saved levels. */
export interface DraftRepository {
  list(): Promise<Draft[]>;
  get(levelId: string): Promise<Draft | null>;
  save(level: Level, now: number): Promise<void>;
  remove(levelId: string): Promise<void>;
}

export interface RecordSubmission {
  best: number;
  previousBest: number | null;
  isNewRecord: boolean;
}

export interface RecordsRepository {
  getBest(levelId: string): Promise<number | null>;
  getAllBests(): Promise<Record<string, number>>;
  submit(levelId: string, time: number): Promise<RecordSubmission>;
}

export interface Repositories {
  levels: LevelRepository;
  drafts: DraftRepository;
  records: RecordsRepository;
}
