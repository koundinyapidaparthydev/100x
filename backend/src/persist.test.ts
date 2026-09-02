/**
 * Persistence smoke tests — only run when DATA_DIR is set for the suite.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  databaseSslConfig,
  initializePostgresForTest,
  loadOrCreateStore,
  resolveDataPath,
  saveStore,
} from './persist';
import { applyDemoSeed, hasDemoSeed } from './demoSeed';
import { createSeedStore } from './store';

describe('persist', () => {
  const prevPersist = process.env.PERSIST;
  const prevDir = process.env.DATA_DIR;
  let tmp: string;

  afterEach(() => {
    if (prevPersist === undefined) delete process.env.PERSIST;
    else process.env.PERSIST = prevPersist;
    if (prevDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevDir;
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null path when persistence is disabled', () => {
    delete process.env.PERSIST;
    delete process.env.DATA_DIR;
    expect(resolveDataPath()).toBeNull();
  });

  it('round-trips a store to disk', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), '100x-persist-'));
    process.env.DATA_DIR = tmp;
    const store = createSeedStore();
    store.workItems[0]!.title = 'Persisted title';
    saveStore(store);

    const loaded = loadOrCreateStore();
    expect(loaded.workItems[0]!.title).toBe('Persisted title');
    expect(fs.existsSync(path.join(tmp, 'store.json'))).toBe(true);
  });

  it('persists Code MVP demo seed across load', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), '100x-persist-'));
    process.env.DATA_DIR = tmp;
    const seeded = createSeedStore();
    applyDemoSeed(seeded);
    saveStore(seeded);
    const loaded = loadOrCreateStore();
    expect(hasDemoSeed(loaded)).toBe(true);
    expect(loaded.workItems.some((w) => w.id === 'wi-mvp-a')).toBe(true);
  });

  it('loads and saves a PostgreSQL snapshot with parameterized values', async () => {
    const persisted = createSeedStore();
    persisted.workItems[0]!.title = 'Loaded from PostgreSQL';
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const client = {
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        if (text.startsWith('SELECT snapshot')) return { rows: [{ snapshot: persisted, version: '4' }] };
        if (text.startsWith('UPDATE app_store_snapshots')) return { rows: [{ version: '5' }] };
        return { rows: [] };
      },
      async end() {},
    };

    const { store, persistence } = await initializePostgresForTest(client);
    expect(store.workItems[0]!.title).toBe('Loaded from PostgreSQL');

    store.workItems[0]!.title = 'Saved to PostgreSQL';
    persistence.schedule(store);
    await persistence.flush();
    await persistence.close();

    const write = calls.find((call) => call.text.startsWith('UPDATE app_store_snapshots'));
    expect(write?.text).toContain('$2::jsonb');
    expect(write?.text).toContain('version = $3::bigint');
    expect(write?.values?.[0]).toBe('primary');
    expect(JSON.parse(String(write?.values?.[1])).workItems[0].title).toBe('Saved to PostgreSQL');
    expect(write?.values?.[2]).toBe('4');
  });

  it('refuses to overwrite when the PostgreSQL snapshot version conflicts', async () => {
    const persisted = createSeedStore();
    const client = {
      async query(text: string, _values?: unknown[]) {
        if (text.startsWith('SELECT snapshot')) return { rows: [{ snapshot: persisted, version: '7' }] };
        // Empty RETURNING set simulates another writer bumping version first.
        if (text.startsWith('UPDATE app_store_snapshots')) return { rows: [] };
        return { rows: [] };
      },
      async end() {},
    };

    const { store, persistence } = await initializePostgresForTest(client);
    store.workItems[0]!.title = 'Stale writer';
    persistence.schedule(store);
    await expect(persistence.flush()).rejects.toThrow(/changed concurrently/);
    await persistence.close().catch(() => undefined);
  });

  it('uses explicit SSL modes without inspecting or logging DATABASE_URL', () => {
    expect(databaseSslConfig('disable')).toBe(false);
    expect(databaseSslConfig('require')).toEqual({ rejectUnauthorized: false });
    expect(databaseSslConfig('verify-full')).toEqual({ rejectUnauthorized: true });
    expect(() => databaseSslConfig('invalid')).toThrow(/DATABASE_SSL_MODE/);
  });
});
