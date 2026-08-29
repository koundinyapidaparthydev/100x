/**
 * Live PostgreSQL integration tests.
 *
 * Prefer TEST_DATABASE_URL (dedicated test DB). Falls back to DATABASE_URL.
 * Skips cleanly when neither is set — Docker/Testcontainers are not required on this machine.
 *
 * Run: npm run test:integration -w 100x-backend
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { initializePostgresForTest } from './persist';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('postgres integration (live)', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 2,
      connectionTimeoutMillis: 10_000,
      ssl: false,
    });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('round-trips a snapshot and detects optimistic concurrency conflicts', async () => {
    const client = {
      query: (text: string, values?: unknown[]) => pool.query(text, values),
      end: async () => {
        // Shared pool is closed in afterAll; do not end it per persistence instance.
      },
    };

    // Isolate from any primary row used by a local/dev process.
    await pool.query('DELETE FROM app_store_snapshots WHERE id = $1', ['primary']).catch(() => undefined);

    const first = await initializePostgresForTest(client);
    expect(first.persistence.kind).toBe('postgres');
    first.store.workItems[0]!.title = 'Integration seed';
    first.persistence.schedule(first.store);
    await first.persistence.flush();

    const second = await initializePostgresForTest(client);
    expect(second.store.workItems[0]!.title).toBe('Integration seed');

    // Simulate an external writer bumping the row version while this client holds a stale version.
    await pool.query(
      `UPDATE app_store_snapshots
       SET version = version + 1, updated_at = NOW()
       WHERE id = $1`,
      ['primary'],
    );

    second.store.workItems[0]!.title = 'Stale concurrent write';
    second.persistence.schedule(second.store);
    await expect(second.persistence.flush()).rejects.toThrow(/changed concurrently/);

    // Cleanup so repeated local runs stay deterministic.
    await pool.query('DELETE FROM app_store_snapshots WHERE id = $1', ['primary']);
  });
});
