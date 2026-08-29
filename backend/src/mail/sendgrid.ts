/**
 * Twilio SendGrid v3 Mail Send — 100x fallback for workspace invites.
 * Uses fetch (no SDK). Enabled only when SENDGRID_API_KEY (SG.*) + SENDGRID_FROM_EMAIL are set.
 */

export type SendgridMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Correlates Event Webhook / support (invite id). */
  customArgs?: Record<string, string>;
};

export type SendgridSendResult = {
  statusCode: number;
  messageId: string | null;
};

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/** Live SendGrid when a real API key and verified from-address are configured. */
export function sendgridConfigured(): boolean {
  const key = trimEnv('SENDGRID_API_KEY');
  const from = trimEnv('SENDGRID_FROM_EMAIL');
  return Boolean(key?.startsWith('SG.') && from);
}

export function sendgridFromAddress(): { email: string; name?: string } {
  const email = trimEnv('SENDGRID_FROM_EMAIL');
  if (!email) {
    throw new Error('SENDGRID_FROM_EMAIL is required when SendGrid is enabled');
  }
  const name = trimEnv('SENDGRID_FROM_NAME');
  return name ? { email, name } : { email };
}

/**
 * POST /v3/mail/send — 202 = queued; 200 = sandbox validation only.
 * @see https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
export async function sendWithSendgrid(input: SendgridMailInput): Promise<SendgridSendResult> {
  const apiKey = trimEnv('SENDGRID_API_KEY');
  if (!apiKey?.startsWith('SG.')) {
    throw Object.assign(new Error('SendGrid is not configured'), { status: 503 });
  }

  const sandbox = trimEnv('SENDGRID_SANDBOX') === '1' || trimEnv('SENDGRID_SANDBOX') === 'true';
  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: input.to }] }],
    from: sendgridFromAddress(),
    subject: input.subject,
    content: [
      { type: 'text/plain', value: input.text },
      { type: 'text/html', value: input.html },
    ],
    categories: ['workspace_invite'],
  };
  if (input.customArgs && Object.keys(input.customArgs).length > 0) {
    body.custom_args = input.customArgs;
  }
  if (sandbox) {
    body.mail_settings = { sandbox_mode: { enable: true } };
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = (await res.json()) as { errors?: Array<{ message?: string }> };
      const msg = errBody.errors?.map((e) => e.message).filter(Boolean).join('; ');
      if (msg) detail = msg;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw Object.assign(new Error(`SendGrid mail send failed (${res.status}): ${detail}`), {
      status: 502,
    });
  }

  return {
    statusCode: res.status,
    messageId: res.headers.get('x-message-id'),
  };
}
