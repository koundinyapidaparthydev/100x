#!/usr/bin/env node
/**
 * Assert / top-up the demo triage queue via the live API.
 *
 * Expects a backend with AUTH_ALLOW_DEMO_LOGIN=1 (or non-production demo seats).
 *
 *   API_BASE_URL=http://localhost:4000/api/v1 npm run seed:demo-queue
 *
 * Exits non-zero when triage-pending count is outside 15–22 after optional top-up.
 */
const API_BASE = (process.env.API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const TARGET = 18;
const MIN = 15;
const MAX = 22;
const IDENTITY = (process.env.SEED_DEMO_IDENTITY || 'root').toLowerCase();

/** @param {string} path */
/** @param {RequestInit & { token?: string }} [init] */
async function api(path, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

async function login(identity) {
  const res = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identity, surface: 'web' }),
  });
  if (!res.ok) {
    const msg = typeof res.body === 'object' && res.body?.error ? res.body.error : res.status;
    throw new Error(`login as ${identity} failed (${msg}). Is AUTH_ALLOW_DEMO_LOGIN=1 set on the backend?`);
  }
  const token = res.body?.session?.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('login response missing session.token');
  }
  return token;
}

async function triagePendingCount() {
  const res = await api('/work-items?triagePending=true');
  if (!res.ok || !Array.isArray(res.body)) {
    throw new Error(`GET /work-items?triagePending=true failed (${res.status})`);
  }
  return res.body.length;
}

async function pendingApprovalsCount(token) {
  let res = await api('/approvals', { token });
  // Manager seats often lack approvals.read; fall back to root for the count.
  if (res.status === 403) {
    const rootToken = await login('root');
    res = await api('/approvals', { token: rootToken });
  }
  if (!res.ok || !Array.isArray(res.body)) {
    throw new Error(`GET /approvals failed (${res.status}): ${res.body?.error ?? ''}`);
  }
  return res.body.filter((a) => a?.status === 'pending').length;
}

function buildSeedIssues(n) {
  const priorities = ['low', 'medium', 'high', 'critical'];
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    return {
      title: `Demo queue top-up ${k}: sandbox triage card`,
      description: `Seeded by seed-demo-queue for swipe/demo depth (${k}/${n}).`,
      priority: priorities[i % priorities.length],
    };
  });
}

async function connectSandboxBoard(token, seedCount) {
  const candidates = ['DEMO', 'DEMO2', 'DEMO3', 'DEMO4', 'DEMO5'];
  const seedIssues = buildSeedIssues(seedCount);
  let authToken = token;
  for (const projectId of candidates) {
    const res = await api('/boards/connect', {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({
        projectId,
        name: `${projectId} sandbox board`,
        seedIssues,
      }),
    });
    if (res.status === 201) {
      return { projectId, seeded: seedCount };
    }
    if (res.status === 409) {
      continue;
    }
    if (res.status === 403) {
      console.warn('boards.connect forbidden; retrying as root…');
      authToken = await login('root');
      const retry = await api('/boards/connect', {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({
          projectId,
          name: `${projectId} sandbox board`,
          seedIssues,
        }),
      });
      if (retry.status === 201) {
        return { projectId, seeded: seedCount };
      }
      if (retry.status === 409) {
        continue;
      }
      throw new Error(
        `POST /boards/connect ${projectId} failed (${retry.status}): ${retry.body?.error ?? JSON.stringify(retry.body)}`,
      );
    }
    throw new Error(
      `POST /boards/connect ${projectId} failed (${res.status}): ${res.body?.error ?? JSON.stringify(res.body)}`,
    );
  }
  throw new Error(
    `could not connect a sandbox board (tried ${candidates.join(', ')}); all already connected or rejected`,
  );
}

async function main() {
  console.log(`API_BASE_URL=${API_BASE}`);
  console.log(`identity=${IDENTITY}`);

  let token;
  try {
    token = await login(IDENTITY);
  } catch (err) {
    if (IDENTITY !== 'root') {
      console.warn(String(err.message || err));
      console.warn('retrying login as root…');
      token = await login('root');
    } else {
      throw err;
    }
  }

  let triage = await triagePendingCount();
  console.log(`triage-pending (before): ${triage}`);

  if (triage < MIN) {
    const need = Math.max(TARGET - triage, 1);
    console.log(`count < ${MIN}; topping up with ${need} seedIssues via boards/connect…`);
    const connected = await connectSandboxBoard(token, need);
    console.log(`connected board ${connected.projectId} (+${connected.seeded} work items)`);
    triage = await triagePendingCount();
  } else {
    console.log(`count already ≥ ${MIN}; no top-up`);
  }

  const approvals = await pendingApprovalsCount(token);
  console.log(`triage-pending: ${triage}`);
  console.log(`pending approvals: ${approvals}`);

  if (triage < MIN || triage > MAX) {
    console.error(`FAIL: triage-pending ${triage} outside ${MIN}–${MAX}`);
    process.exit(1);
  }
  console.log(`OK: triage-pending within ${MIN}–${MAX} (target ~${TARGET})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
