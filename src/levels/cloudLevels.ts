import { parseLevel } from './levelSerialization';
import type { StorageLike } from './localLevelRepository';
import type { Level } from './levelTypes';

export const CLOUD_STORAGE_KEY = 'inkskater.cloud.v1';

export const OWNER_STORAGE_KEY = 'inkskater.owner.v1';

export interface CloudConfig {
  url: string;
}

export interface CloudLevel {
  level: Level;
  updatedAt: number;
  /** True when this device's owner key created the level, so it may change or delete it. */
  mine: boolean;
}

/** Random per-device key. The server stores only its hash and compares on every change. */
function loadOwnerKey(storage: StorageLike | null): string {
  try {
    const existing = storage?.getItem(OWNER_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    /* fall through to a session-only key */
  }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    storage?.setItem(OWNER_STORAGE_KEY, key);
  } catch {
    /* kept in memory for this session */
  }
  return key;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadCloudConfig(storage: StorageLike | null): CloudConfig {
  try {
    const raw = storage?.getItem(CLOUD_STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (isRecord(data)) {
      return { url: typeof data.url === 'string' ? data.url : '' };
    }
  } catch {
    /* ignore corrupt or blocked storage */
  }
  return { url: '' };
}

export class CloudLevels {
  private config: CloudConfig;
  private readonly ownerKey: string;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly fetchFn: FetchLike = (input, init) => fetch(input, init),
  ) {
    this.config = loadCloudConfig(storage);
    this.ownerKey = loadOwnerKey(storage);
  }

  getConfig(): CloudConfig {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return this.config.url !== '';
  }

  setConfig(config: CloudConfig): void {
    this.config = { url: config.url.trim() };
    try {
      this.storage?.setItem(CLOUD_STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      /* kept in memory for this session */
    }
  }

  async list(): Promise<CloudLevel[]> {
    const url = this.endpoint();
    url.searchParams.set('action', 'list');
    url.searchParams.set('ownerKey', this.ownerKey);
    const data = await this.request(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!Array.isArray(data.levels)) throw new Error('The cloud sent back something unexpected.');
    const out: CloudLevel[] = [];
    for (const row of data.levels as unknown[]) {
      if (!isRecord(row) || typeof row.json !== 'string') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.json);
      } catch {
        continue;
      }
      const level = parseLevel(parsed);
      if (level) out.push({ level, updatedAt: level.updatedAt, mine: row.mine === true });
    }
    return out;
  }

  async save(level: Level, overwrite = false): Promise<void> {
    await this.post({ action: 'save', level, overwrite });
  }

  async remove(id: string): Promise<void> {
    await this.post({ action: 'delete', id });
  }

  private endpoint(): URL {
    if (!this.isConfigured()) throw new Error('Set up the cloud first (the Web App URL).');
    try {
      const url = new URL(this.config.url);
      if (url.protocol !== 'https:') throw new Error('not https');
      return url;
    } catch {
      throw new Error('The Web App URL does not look right. It should start with https://');
    }
  }

  private async post(body: Record<string, unknown>): Promise<void> {
    const url = this.endpoint();
    await this.request(url.toString(), {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, ownerKey: this.ownerKey }),
    });
  }

  private async request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await this.fetchFn(url, init);
    } catch {
      throw new Error('Could not reach the cloud. Check your connection and the Web App URL.');
    }
    if (!res.ok) throw new Error(`The cloud answered with an error (${res.status}).`);
    let data: unknown;
    try {
      data = JSON.parse(await res.text());
    } catch {
      throw new Error(
        'The cloud did not answer correctly. Check the URL and that access is set to "Anyone".',
      );
    }
    if (!isRecord(data)) throw new Error('The cloud sent back something unexpected.');
    if (data.ok !== true) {
      const msg =
        typeof data.error === 'string' && data.error !== '' ? data.error : 'Unknown error.';
      throw new Error(`Cloud: ${msg.slice(0, 120)}`);
    }
    return data;
  }
}
