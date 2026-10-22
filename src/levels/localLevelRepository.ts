import { parseLevel } from './levelSerialization';
import type {
  Draft,
  DraftRepository,
  LevelRepository,
  RecordSubmission,
  RecordsRepository,
  Repositories,
} from './levelRepository';
import type { Level } from './levelTypes';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  levels: 'inkskater.levels.v1',
  drafts: 'inkskater.drafts.v1',
  records: 'inkskater.records.v1',
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readJson(storage: StorageLike, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function readLevels(storage: StorageLike): Level[] {
  const data = readJson(storage, STORAGE_KEYS.levels);
  if (!isRecord(data) || !Array.isArray(data.levels)) return [];
  const out: Level[] = [];
  const seen = new Set<string>();
  for (const raw of data.levels as unknown[]) {
    const level = parseLevel(raw);
    if (level && !seen.has(level.id)) {
      seen.add(level.id);
      out.push(level);
    }
  }
  return out;
}

class LocalLevels implements LevelRepository {
  constructor(private readonly storage: StorageLike) {}

  list(): Promise<Level[]> {
    return Promise.resolve(readLevels(this.storage).sort((a, b) => b.updatedAt - a.updatedAt));
  }

  get(id: string): Promise<Level | null> {
    return Promise.resolve(readLevels(this.storage).find((l) => l.id === id) ?? null);
  }

  save(level: Level): Promise<void> {
    try {
      const levels = readLevels(this.storage).filter((l) => l.id !== level.id);
      levels.push({ ...level, kind: 'custom' });
      writeJson(this.storage, STORAGE_KEYS.levels, { version: 1, levels });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error('Could not save level'));
    }
  }

  remove(id: string): Promise<void> {
    const levels = readLevels(this.storage).filter((l) => l.id !== id);
    writeJson(this.storage, STORAGE_KEYS.levels, { version: 1, levels });
    return Promise.resolve();
  }
}

function readDrafts(storage: StorageLike): Draft[] {
  const data = readJson(storage, STORAGE_KEYS.drafts);
  if (!isRecord(data) || !Array.isArray(data.drafts)) return [];
  const out: Draft[] = [];
  for (const raw of data.drafts as unknown[]) {
    if (!isRecord(raw)) continue;
    const level = parseLevel(raw.level);
    const savedAt =
      typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0;
    if (level) out.push({ level, savedAt });
  }
  return out;
}

class LocalDrafts implements DraftRepository {
  constructor(private readonly storage: StorageLike) {}

  list(): Promise<Draft[]> {
    return Promise.resolve(readDrafts(this.storage).sort((a, b) => b.savedAt - a.savedAt));
  }

  get(levelId: string): Promise<Draft | null> {
    return Promise.resolve(readDrafts(this.storage).find((d) => d.level.id === levelId) ?? null);
  }

  save(level: Level, now: number): Promise<void> {
    try {
      const drafts = readDrafts(this.storage).filter((d) => d.level.id !== level.id);
      drafts.push({ level, savedAt: now });
      writeJson(this.storage, STORAGE_KEYS.drafts, { version: 1, drafts });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error('Could not save draft'));
    }
  }

  remove(levelId: string): Promise<void> {
    const drafts = readDrafts(this.storage).filter((d) => d.level.id !== levelId);
    writeJson(this.storage, STORAGE_KEYS.drafts, { version: 1, drafts });
    return Promise.resolve();
  }
}

function readRecords(storage: StorageLike): Record<string, number> {
  const data = readJson(storage, STORAGE_KEYS.records);
  const out: Record<string, number> = {};
  if (!isRecord(data)) return out;
  for (const [id, value] of Object.entries(data)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[id] = value;
  }
  return out;
}

class LocalRecords implements RecordsRepository {
  constructor(private readonly storage: StorageLike) {}

  getBest(levelId: string): Promise<number | null> {
    return Promise.resolve(readRecords(this.storage)[levelId] ?? null);
  }

  getAllBests(): Promise<Record<string, number>> {
    return Promise.resolve(readRecords(this.storage));
  }

  submit(levelId: string, time: number): Promise<RecordSubmission> {
    const records = readRecords(this.storage);
    const previousBest = records[levelId] ?? null;
    const isNewRecord = previousBest === null || time < previousBest;
    if (isNewRecord) {
      records[levelId] = time;
      try {
        writeJson(this.storage, STORAGE_KEYS.records, records);
      } catch {
        /* storage full or blocked: the result is still reported for this session */
      }
    }
    return Promise.resolve({
      best: isNewRecord ? time : (previousBest ?? time),
      previousBest,
      isNewRecord,
    });
  }
}

export function createLocalRepositories(storage: StorageLike): Repositories {
  return {
    levels: new LocalLevels(storage),
    drafts: new LocalDrafts(storage),
    records: new LocalRecords(storage),
  };
}

/** In-memory storage for tests and for browsers where localStorage is blocked. */
export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}
