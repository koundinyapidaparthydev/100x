import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendWithSendgrid, sendgridConfigured } from './sendgrid';

const ENV_KEYS = [
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
  'SENDGRID_FROM_NAME',
  'SENDGRID_SANDBOX',
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setEnv(partial: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (!(key in saved)) saved[key] = process.env[key];
  }
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('sendgridConfigured', () => {
  it('is false without credentials', () => {
    for (const key of ENV_KEYS) {
      if (!(key in saved)) saved[key] = process.env[key];
      delete process.env[key];
    }
    expect(sendgridConfigured()).toBe(false);
  });

  it('rejects placeholder keys that are not SG.*', () => {
    setEnv({
      SENDGRID_API_KEY: 'REPLACE_ME_SENDGRID_API_KEY',
      SENDGRID_FROM_EMAIL: 'noreply@100x.com',
    });
    expect(sendgridConfigured()).toBe(false);
  });

  it('is true with SG key and from email', () => {
    setEnv({
      SENDGRID_API_KEY: 'SG.testdummykey',
      SENDGRID_FROM_EMAIL: 'noreply@100x.com',
    });
    expect(sendgridConfigured()).toBe(true);
  });
});

describe('sendWithSendgrid', () => {
  it('POSTs mail/send and returns message id', async () => {
    setEnv({
      SENDGRID_API_KEY: 'SG.testdummykey',
      SENDGRID_FROM_EMAIL: 'noreply@100x.com',
      SENDGRID_FROM_NAME: '100x',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: { get: (h: string) => (h.toLowerCase() === 'x-message-id' ? 'msg-1' : null) },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWithSendgrid({
      to: 'alex@contoso.com',
      subject: 'Invite',
      text: 'plain',
      html: '<p>html</p>',
      customArgs: { invite_id: 'inv-1' },
    });

    expect(result).toEqual({ statusCode: 202, messageId: 'msg-1' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SG.testdummykey');
    const body = JSON.parse(String(init.body)) as {
      from: { email: string; name: string };
      personalizations: Array<{ to: Array<{ email: string }> }>;
      custom_args: Record<string, string>;
    };
    expect(body.from).toEqual({ email: 'noreply@100x.com', name: '100x' });
    expect(body.personalizations[0]?.to[0]?.email).toBe('alex@contoso.com');
    expect(body.custom_args.invite_id).toBe('inv-1');
  });

  it('surfaces SendGrid error messages', async () => {
    setEnv({
      SENDGRID_API_KEY: 'SG.testdummykey',
      SENDGRID_FROM_EMAIL: 'noreply@100x.com',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ errors: [{ message: 'Invalid API key' }] }),
      }),
    );

    await expect(
      sendWithSendgrid({
        to: 'a@b.com',
        subject: 'x',
        text: 'x',
        html: '<p>x</p>',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Invalid API key'),
      status: 502,
    });
  });
});
