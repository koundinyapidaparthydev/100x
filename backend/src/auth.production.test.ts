/**
 * Production auth posture — demo login gating and session secret requirements.
 * Mutates process.env; restores after each case so other suites stay isolated.
 */

import type { Express } from 'express';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { demoAuthEnabled, issueSession } from './auth';
import { createSeedStore } from './store';

const PROD_SECRET = 'aplifyai-prod-test-session-secret-32b';

const envKeys = ['NODE_ENV', 'AUTH_ALLOW_DEMO_LOGIN', 'AUTH_SESSION_SECRET'] as const;

describe('production auth posture', () => {
  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function app(): Express {
    return createApp(createSeedStore());
  }

  it('rejects demo login when NODE_ENV=production and AUTH_ALLOW_DEMO_LOGIN is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_ALLOW_DEMO_LOGIN;
    process.env.AUTH_SESSION_SECRET = PROD_SECRET;

    expect(demoAuthEnabled()).toBe(false);
    expect(issueSession({ identity: 'manager' })).toBeNull();

    const res = await supertest(app()).post('/api/v1/auth/login').send({ identity: 'manager' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/demo login disabled/i);

    const users = await supertest(app()).get('/api/v1/auth/demo-users');
    expect(users.status).toBe(404);
  });

  it('rejects demo login when AUTH_ALLOW_DEMO_LOGIN is falsey (not 1)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ALLOW_DEMO_LOGIN = '0';
    process.env.AUTH_SESSION_SECRET = PROD_SECRET;

    expect(demoAuthEnabled()).toBe(false);
    await supertest(app()).post('/api/v1/auth/login').send({ identity: 'manager' }).expect(404);
  });

  it('allows demo login in production when AUTH_ALLOW_DEMO_LOGIN=1', async () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ALLOW_DEMO_LOGIN = '1';
    process.env.AUTH_SESSION_SECRET = PROD_SECRET;

    expect(demoAuthEnabled()).toBe(true);
    const session = issueSession({ identity: 'manager' });
    expect(session?.token).toMatch(/^oh1\./);
    expect(session?.user.roleId).toBeNull();

    const res = await supertest(app()).post('/api/v1/auth/login').send({ identity: 'manager' }).expect(200);
    expect(res.body.session.token).toMatch(/^oh1\./);
  });

  it('requires AUTH_SESSION_SECRET (32+) when issuing sessions in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ALLOW_DEMO_LOGIN = '1';
    delete process.env.AUTH_SESSION_SECRET;

    expect(() => issueSession({ identity: 'manager' })).toThrow(/AUTH_SESSION_SECRET/);
  });

  it('rejects short AUTH_SESSION_SECRET values in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ALLOW_DEMO_LOGIN = '1';
    process.env.AUTH_SESSION_SECRET = 'too-short';

    expect(() => issueSession({ identity: 'manager' })).toThrow(/AUTH_SESSION_SECRET/);
  });
});
