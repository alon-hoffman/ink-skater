import type { Level, SpawnDirection, Stroke, ValidationInfo, Vec2 } from './levelTypes';

export const MAX_STROKES = 400;
export const MAX_POINTS_PER_STROKE = 2000;
const COORD_LIMIT = 1_000_000;

export function serializeLevel(level: Level): string {
  return JSON.stringify(level);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function coord(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < COORD_LIMIT ? v : null;
}

function parseVec(v: unknown): Vec2 | null {
  if (!isRecord(v)) return null;
  const x = coord(v.x);
  const y = coord(v.y);
  return x === null || y === null ? null : { x, y };
}

function parseStroke(v: unknown, index: number): Stroke | null {
  if (!isRecord(v) || !Array.isArray(v.points)) return null;
  const points: Vec2[] = [];
  for (const p of (v.points as unknown[]).slice(0, MAX_POINTS_PER_STROKE)) {
    const pt = parseVec(p);
    if (pt) points.push(pt);
  }
  if (points.length < 2) return null;
  const id = typeof v.id === 'string' && v.id !== '' ? v.id : `stroke-${index}`;
  return { id, points };
}

function parseValidation(v: unknown): ValidationInfo {
  const none: ValidationInfo = { validatedRevision: null, completionTime: null, validatedAt: null };
  if (!isRecord(v)) return none;
  const rev =
    typeof v.validatedRevision === 'number' && Number.isInteger(v.validatedRevision)
      ? v.validatedRevision
      : null;
  if (rev === null) return none;
  return {
    validatedRevision: rev,
    completionTime:
      typeof v.completionTime === 'number' && Number.isFinite(v.completionTime)
        ? v.completionTime
        : null,
    validatedAt:
      typeof v.validatedAt === 'number' && Number.isFinite(v.validatedAt) ? v.validatedAt : null,
  };
}

/** Validate untrusted data (localStorage, imports). Returns null when it is not a usable level. */
export function parseLevel(raw: unknown): Level | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id === '') return null;
  const spawn = parseVec(raw.spawn);
  const flag = parseVec(raw.flag);
  if (!spawn || !flag || !Array.isArray(raw.strokes)) return null;
  const strokes: Stroke[] = [];
  (raw.strokes as unknown[]).slice(0, MAX_STROKES).forEach((s, i) => {
    const stroke = parseStroke(s, i);
    if (stroke) strokes.push(stroke);
  });
  const direction: SpawnDirection = raw.spawnDirection === -1 ? -1 : 1;
  const now = Date.now();
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    id: raw.id,
    name:
      typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.slice(0, 60) : 'Untitled',
    kind: 'custom',
    strokes,
    spawn,
    spawnDirection: direction,
    flag,
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    revision: Math.max(1, Math.floor(num(raw.revision, 1))),
    validation: parseValidation(raw.validation),
  };
}

export function deserializeLevel(json: string): Level | null {
  try {
    return parseLevel(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
