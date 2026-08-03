/**
 * Store persistence.
 *
 * DATABASE_URL selects a PostgreSQL JSONB snapshot. Otherwise the original
 * file-backed mode (PERSIST=1 / DATA_DIR) or pure in-memory mode is retained.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { normalizeCustomerNames, normalizePiiMap } from '../../shared/piiPolicy';
import type { Policy } from '../../shared/types';
import type { Store } from './store';
import { createSeedStore } from './store';

const SAVE_DELAY_MS = 250;
const SNAPSHOT_ID = 'primary';

export interface Persistence {
  readonly kind: 'memory' | 'file' | 'postgres';
  schedule(store: Store): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

interface SqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

interface SnapshotRow {
  snapshot: unknown;
  version: unknown;
}

function hydrateStore(value: unknown): Store {
  if (!value || typeof value !== 'object') throw new Error('invalid store shape');
  const parsed = value as Store;
  if (!Array.isArray(parsed.workItems) || !Array.isArray(parsed.policies)) {
    throw new Error('invalid store shape');
  }
  // Defaults for snapshots written by older application versions.
  if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
  if (!Array.isArray(parsed.auditEvents)) parsed.auditEvents = [];
  if (!Array.isArray(parsed.approvals)) parsed.approvals = [];
  if (!Array.isArray(parsed.notifications)) parsed.notifications = [];
  if (!Array.isArray(parsed.boards)) parsed.boards = [];
  if (typeof parsed.attachmentCounter !== 'number') parsed.attachmentCounter = 0;
  if (!parsed.onboardingByUser || typeof parsed.onboardingByUser !== 'object') {
    parsed.onboardingByUser = {};
  }
  // Drop legacy tenant-scoped completion so SSO users on a shared demo tenant
  // are not skipped after someone else finished the wizard.
  delete parsed.onboardingByTenant;
  if (!parsed.invitesByTenant || typeof parsed.invitesByTenant !== 'object') {
    parsed.invitesByTenant = {};
  }
  if (!parsed.usersByTenant || typeof parsed.usersByTenant !== 'object') {
    parsed.usersByTenant = {};
  }
  if (!parsed.groupsByTenant || typeof parsed.groupsByTenant !== 'object') {
    parsed.groupsByTenant = {};
  }
  if (!Array.isArray(parsed.iamImportJobs)) {
    parsed.iamImportJobs = [];
  }
  if (!Array.isArray(parsed.emailOutbox)) {
    parsed.emailOutbox = [];
  }
  if (!parsed.mcpConnectionsByTenant || typeof parsed.mcpConnectionsByTenant !== 'object') {
    parsed.mcpConnectionsByTenant = {};
  }
  // Migrate legacy string PII modes → full clearing rules.
  parsed.policies = parsed.policies.map((policy) => {
    const legacy = policy as Policy & { pii?: unknown; customerNames?: unknown };
    return {
      ...policy,
      pii: normalizePiiMap(legacy.pii as Policy['pii']),
      customerNames: normalizeCustomerNames(legacy.customerNames),
    };
  });
  return parsed;
}

export function resolveDataPath(): string | null {
  if (process.env.PERSIST !== '1' && !process.env.DATA_DIR) return null;
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
  return path.join(dir, 'store.json');
}

export function loadOrCreateStore(): Store {
  const file = resolveDataPath();
  if (!file) return createSeedStore();

  try {
    if (fs.existsSync(file)) {
      return hydrateStore(JSON.parse(fs.readFileSync(file, 'utf8')));
    }
  } catch (err) {
    console.warn('[persist] failed to load store, reseeding:', err instanceof Error ? err.message : err);
  }

  const seeded = createSeedStore();
  saveStore(seeded);
  return seeded;
}

export function saveStore(store: Store): void {
  const file = resolveDataPath();
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

class LocalPersistence implements Persistence {
  readonly kind: 'memory' | 'file';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingStore: Store | null = null;

  constructor() {
    this.kind = resolveDataPath() ? 'file' : 'memory';
  }

  schedule(store: Store): void {
    if (this.kind === 'memory') return;
    this.pendingStore = store;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingStore) {
      const store = this.pendingStore;
      this.pendingStore = null;
      saveStore(store);
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }
}

class PostgresPersistence implements Persistence {
  readonly kind = 'postgres' as const;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private store: Store | null = null;
  private requestedRevision = 0;
  private savedRevision = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly client: SqlClient,
    private databaseVersion: string,
  ) {}

  schedule(store: Store): void {
    this.store = store;
    this.requestedRevision += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch((err: unknown) => {
        console.error('[persist] PostgreSQL snapshot save failed:', err instanceof Error ? err.message : err);
      });
    }, SAVE_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      while (this.store && this.savedRevision < this.requestedRevision) {
        const revision = this.requestedRevision;
        const snapshot = JSON.stringify(this.store);
        const result = await this.client.query(
          `UPDATE app_store_snapshots
           SET snapshot = $2::jsonb,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $1 AND version = $3::bigint
           RETURNING version`,
          [SNAPSHOT_ID, snapshot, this.databaseVersion],
        );
        const updated = result.rows[0] as { version?: unknown } | undefined;
        if (!updated) {
          throw new Error('PostgreSQL snapshot changed concurrently; refusing to overwrite it');
        }
        this.databaseVersion = normalizeVersion(updated.version);
        this.savedRevision = revision;
      }
    });
    await this.writeQueue;
  }

  async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      await this.client.end();
    }
  }
}

export type DatabaseSslMode = 'disable' | 'require' | 'verify-full';

export function databaseSslConfig(
  mode = process.env.DATABASE_SSL_MODE ?? 'disable',
): false | { rejectUnauthorized: boolean } {
  if (mode === 'disable') return false;
  if (mode === 'require') return { rejectUnauthorized: false };
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  throw new Error('DATABASE_SSL_MODE must be disable, require, or verify-full');
}

function normalizeVersion(value: unknown): string {
  if ((typeof value === 'string' && /^\d+$/.test(value)) || (typeof value === 'number' && Number.isInteger(value))) {
    return String(value);
  }
  throw new Error('invalid PostgreSQL snapshot version');
}

async function initializePostgres(
  databaseUrl: string,
  suppliedClient?: SqlClient,
): Promise<{ store: Store; persistence: Persistence }> {
  const max = Number(process.env.DATABASE_POOL_MAX ?? 2);
  if (!Number.isInteger(max) || max < 1) throw new Error('DATABASE_POOL_MAX must be a positive integer');
  const client: SqlClient =
    suppliedClient ??
    new Pool({
      connectionString: databaseUrl,
      ssl: databaseSslConfig(),
      max,
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
    });

  try {
    const attempts = suppliedClient ? 1 : Number(process.env.DATABASE_CONNECT_ATTEMPTS ?? 6);
    if (!Number.isInteger(attempts) || attempts < 1) {
      throw new Error('DATABASE_CONNECT_ATTEMPTS must be a positive integer');
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS app_store_snapshots (
             id text PRIMARY KEY,
             snapshot jsonb NOT NULL,
             version bigint NOT NULL DEFAULT 1,
             updated_at timestamptz NOT NULL DEFAULT NOW()
           )`,
        );
        break;
      } catch (err) {
        if (attempt >= attempts) throw err;
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 1_000, 5_000)));
      }
    }

    const result = await client.query('SELECT snapshot, version FROM app_store_snapshots WHERE id = $1', [SNAPSHOT_ID]);
    const row = result.rows[0] as SnapshotRow | undefined;
    if (row) {
      return {
        store: hydrateStore(row.snapshot),
        persistence: new PostgresPersistence(client, normalizeVersion(row.version)),
      };
    }

    const seeded = createSeedStore();
    await client.query(
      `INSERT INTO app_store_snapshots (id, snapshot, version)
       VALUES ($1, $2::jsonb, 1)
       ON CONFLICT (id) DO NOTHING`,
      [SNAPSHOT_ID, JSON.stringify(seeded)],
    );
    const loaded = await client.query('SELECT snapshot, version FROM app_store_snapshots WHERE id = $1', [SNAPSHOT_ID]);
    const insertedRow = loaded.rows[0] as SnapshotRow | undefined;
    if (!insertedRow) throw new Error('PostgreSQL snapshot initialization failed');
    return {
      store: hydrateStore(insertedRow.snapshot),
      persistence: new PostgresPersistence(client, normalizeVersion(insertedRow.version)),
    };
  } catch (err) {
    await client.end().catch(() => undefined);
    throw err;
  }
}

let activePersistence: Persistence = new LocalPersistence();

/** Called by production bootstrap before accepting requests. */
export async function initializePersistence(): Promise<{ store: Store; persistence: Persistence }> {
  const databaseUrl = process.env.DATABASE_URL;
  const initialized = databaseUrl
    ? await initializePostgres(databaseUrl)
    : { store: loadOrCreateStore(), persistence: new LocalPersistence() };
  activePersistence = initialized.persistence;
  return initialized;
}

/** Test seam for exercising SQL behavior without a live database. */
export async function initializePostgresForTest(
  client: SqlClient,
): Promise<{ store: Store; persistence: Persistence }> {
  return initializePostgres('test-only', client);
}

/** Debounced persistence hook used by the synchronous mutable Store API. */
export function scheduleSave(store: Store): void {
  activePersistence.schedule(store);
}
