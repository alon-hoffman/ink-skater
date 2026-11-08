import { describe, expect, it } from 'vitest';
import { CLOUD_STORAGE_KEY, CloudLevels, OWNER_STORAGE_KEY } from '../src/levels/cloudLevels';
import type { FetchLike } from '../src/levels/cloudLevels';
import { newCustomLevel } from '../src/levels/levelValidation';
import { MemoryStorage } from '../src/levels/localLevelRepository';

const level = newCustomLevel({ id: 'l1', name: 'One', now: 5 });
const reply = (body: unknown, status = 200): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

function setup(fetchFn: FetchLike) {
  const storage = new MemoryStorage();
  const cloud = new CloudLevels(storage, fetchFn);
  cloud.setConfig({ url: ' https://script.google.com/macros/s/x/exec ' });
  return { storage, cloud };
}

describe('CloudLevels', () => {
  it('persists trimmed config', () => {
    const { storage, cloud } = setup(() => Promise.resolve(reply({ ok: true })));
    expect(JSON.parse(storage.getItem(CLOUD_STORAGE_KEY) ?? '{}')).toEqual({
      url: 'https://script.google.com/macros/s/x/exec',
    });
    expect(new CloudLevels(storage).getConfig()).toEqual(cloud.getConfig());
  });

  it('lists with the owner key in the query and skips invalid rows', async () => {
    let seen = '';
    const { cloud } = setup((url) => {
      seen = url;
      return Promise.resolve(
        reply({
          ok: true,
          levels: [
            { id: 'l1', json: JSON.stringify(level), mine: true },
            { id: 'bad', json: '{nope' },
            { id: 'bad2', json: '{"id":1}' },
            42,
          ],
        }),
      );
    });
    const out = await cloud.list();
    expect(seen).toContain('action=list');
    expect(seen).toContain('ownerKey=');
    expect(out.map((c) => [c.level.id, c.mine])).toEqual([['l1', true]]);
  });

  it('posts save as text/plain with the owner key', async () => {
    let init: RequestInit | undefined;
    const { cloud } = setup((_u, i) => {
      init = i;
      return Promise.resolve(reply({ ok: true }));
    });
    await cloud.save(level);
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'text/plain;charset=utf-8',
    );
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body.action).toBe('save');
    expect(String(body.ownerKey)).toMatch(/^[0-9a-f]{48}$/);
  });

  it('posts delete', async () => {
    let body: Record<string, unknown> = {};
    const { cloud } = setup((_u, i) => {
      body = JSON.parse(i?.body as string) as Record<string, unknown>;
      return Promise.resolve(reply({ ok: true }));
    });
    await cloud.remove('l1');
    expect(body).toMatchObject({ action: 'delete', id: 'l1' });
  });

  it('turns failures into friendly errors', async () => {
    await expect(setup(() => Promise.reject(new TypeError('x'))).cloud.list()).rejects.toThrow(
      /Could not reach/,
    );
    await expect(setup(() => Promise.resolve(reply('<html>', 200))).cloud.list()).rejects.toThrow(
      /did not answer correctly/,
    );
    await expect(setup(() => Promise.resolve(reply({}, 500))).cloud.list()).rejects.toThrow(/500/);
    await expect(
      setup(() =>
        Promise.resolve(reply({ ok: false, error: 'Only the creator can change this level.' })),
      ).cloud.remove('a'),
    ).rejects.toThrow(/Only the creator/);
  });

  it('rejects when unconfigured or non-https', async () => {
    const empty = new CloudLevels(new MemoryStorage(), () => Promise.resolve(reply({ ok: true })));
    await expect(empty.list()).rejects.toThrow(/Set up the cloud/);
    const { cloud } = setup(() => Promise.resolve(reply({ ok: true })));
    cloud.setConfig({ url: 'http://example.com' });
    await expect(cloud.list()).rejects.toThrow(/https/);
  });
});

describe('owner key', () => {
  it('is generated once, persisted and reused across instances', () => {
    const storage = new MemoryStorage();
    const bodies: string[] = [];
    const fetchFn: FetchLike = (_u, i) => {
      bodies.push(i?.body as string);
      return Promise.resolve(reply({ ok: true }));
    };
    const a = new CloudLevels(storage, fetchFn);
    a.setConfig({ url: 'https://script.google.com/macros/s/x/exec' });
    const b = new CloudLevels(storage, fetchFn);
    return Promise.all([a.remove('1'), b.remove('2')]).then(() => {
      const keys = bodies.map((s) => (JSON.parse(s) as { ownerKey: string }).ownerKey);
      expect(keys[0]).toBe(keys[1]);
      expect(storage.getItem(OWNER_STORAGE_KEY)).toBe(keys[0]);
    });
  });
});
