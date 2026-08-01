/**
 * Adversarial unit tests for the PII firewall (PII_RESTRICTIONS.md testing requirements).
 */

import { describe, expect, it } from 'vitest';
import type { Policy } from '../../shared/types';
import {
  clearValue,
  luhnValid,
  maskKeepEmailDomain,
  maskKeepLastDigits,
  sanitize,
} from './pii';
import { createSeedStore } from './store';

function seedPolicy(): Policy {
  return createSeedStore().policies[0]!;
}

/** Same as the seeded org policy but with chosen rule overrides. */
function policyWith(
  pii: Partial<Policy['pii']>,
  extra: Partial<Pick<Policy, 'customerNames'>> = {},
): Policy {
  const base = seedPolicy();
  return {
    ...base,
    pii: { ...base.pii, ...pii },
    ...extra,
  };
}

describe('email clearing', () => {
  it('replaces with the configured fixed email by default', () => {
    const { sanitized, report } = sanitize('Reach me at jane.doe@acme-corp.com for details.', seedPolicy());
    expect(sanitized).toBe('Reach me at user@cleared.invalid for details.');
    expect(report).toEqual({ redactions: 1, blocks: [] });
    expect(sanitized).not.toContain('jane.doe@acme-corp.com');
  });

  it('supports placeholder style', () => {
    const { sanitized } = sanitize(
      'a@x.com and b@y.org',
      policyWith({ email: { mode: 'redact', style: 'placeholder' } }),
    );
    expect(sanitized).toBe('[EMAIL_1] and [EMAIL_2]');
  });

  it('supports mask_keep_domain', () => {
    const { sanitized } = sanitize(
      'mail jane.doe@acme-corp.com please',
      policyWith({ email: { mode: 'redact', style: 'mask_keep_domain' } }),
    );
    expect(sanitized).toBe('mail ***@acme-corp.com please');
  });

  it('redacts obfuscated "jane [at] acme [dot] com"', () => {
    const { sanitized, report } = sanitize('Contact jane [at] acme [dot] com please.', seedPolicy());
    expect(report.redactions).toBe(1);
    expect(sanitized).toContain('user@cleared.invalid');
    expect(sanitized.toLowerCase()).not.toContain('[at]');
  });

  it('tolerates zero-width spaces inside an email', () => {
    const { sanitized, report } = sanitize('mail: jane\u200Bdoe@acme\u200B.com', seedPolicy());
    expect(report.redactions).toBe(1);
    expect(sanitized).not.toContain('acme\u200B.com');
  });
});

describe('phone clearing (mask last digits)', () => {
  it('keeps last 4 digits by default', () => {
    const { sanitized, report } = sanitize('Call +1-415-555-0132 now.', seedPolicy());
    expect(report.redactions).toBe(1);
    expect(sanitized).toBe('Call +*-***-***-0132 now.');
    expect(sanitized).not.toContain('415');
  });

  const formats = ['(415) 555-0132', '415.555.0132', '415-555-0132'];
  for (const fmt of formats) {
    it(`masks phone format "${fmt}"`, () => {
      const { sanitized, report } = sanitize(`Call ${fmt} now.`, seedPolicy());
      expect(report.redactions).toBe(1);
      expect(sanitized).toMatch(/\*+.*0132/);
      expect(sanitized).not.toContain('555');
    });
  }

  it('supports placeholder style', () => {
    const { sanitized } = sanitize(
      'Call 415-555-0132 now.',
      policyWith({ phone: { mode: 'redact', style: 'placeholder' } }),
    );
    expect(sanitized).toBe('Call [PHONE_1] now.');
  });
});

describe('mask helpers', () => {
  it('maskKeepLastDigits preserves separators', () => {
    expect(maskKeepLastDigits('4111 1111 1111 1111', 4)).toBe('**** **** **** 1111');
    expect(maskKeepLastDigits('123-45-6789', 4)).toBe('***-**-6789');
  });

  it('maskKeepEmailDomain keeps host', () => {
    expect(maskKeepEmailDomain('jane.doe@acme.com')).toBe('***@acme.com');
    expect(maskKeepEmailDomain('jane [at] acme [dot] com')).toBe('***@acme.com');
  });

  it('clearValue respects fixed replacement', () => {
    expect(
      clearValue('email', 'a@b.com', { mode: 'redact', style: 'fixed', fixedReplacement: 'x@y.z' }, 1),
    ).toBe('x@y.z');
  });
});

describe('ssn detection (default mode: block)', () => {
  it('blocks on ###-##-#### and reports category name only', () => {
    const raw = '123-45-6789';
    const { sanitized, report } = sanitize(`Engineer SSN ${raw} from HR export.`, seedPolicy());
    expect(report.blocks).toEqual(['ssn']);
    expect(JSON.stringify(report)).not.toContain(raw);
    expect(report.redactions).toBe(0);
    void sanitized;
  });

  it('blocks on 9 consecutive digits with boundaries', () => {
    const { report } = sanitize('id 078051120 recorded', seedPolicy());
    expect(report.blocks).toEqual(['ssn']);
  });

  it('does not flag 9 digits embedded in a longer digit run', () => {
    const { report } = sanitize('tracking 1234567890123 end', seedPolicy());
    expect(report.blocks).toEqual([]);
  });

  it('allow mode lets an SSN-like value pass through', () => {
    const raw = '123-45-6789';
    const { sanitized, report } = sanitize(`SSN ${raw}`, policyWith({ ssn: { mode: 'allow' } }));
    expect(sanitized).toBe(`SSN ${raw}`);
    expect(report).toEqual({ redactions: 0, blocks: [] });
  });

  it('redact + mask_keep_last keeps last 4 when not blocked', () => {
    const { sanitized, report } = sanitize(
      'SSN 123-45-6789',
      policyWith({ ssn: { mode: 'redact', style: 'mask_keep_last', keepLastDigits: 4 } }),
    );
    expect(report.blocks).toEqual([]);
    expect(sanitized).toBe('SSN ***-**-6789');
  });
});

describe('credit card detection (default mode: block, Luhn-validated)', () => {
  it('blocks a valid Luhn card number', () => {
    const raw = '4111 1111 1111 1111';
    const { report } = sanitize(`Card on file: ${raw}`, seedPolicy());
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(report.blocks).toEqual(['credit_card']);
    expect(JSON.stringify(report)).not.toContain('4111');
  });

  it('blocks a valid Luhn card with dashes', () => {
    const { report } = sanitize('card 5500-0055-5555-5559 here', seedPolicy());
    expect(report.blocks).toEqual(['credit_card']);
  });

  it('ignores a digit run that fails Luhn', () => {
    expect(luhnValid('4111111111111112')).toBe(false);
    const { report } = sanitize('not a card: 4111 1111 1111 1112', seedPolicy());
    expect(report.blocks).toEqual([]);
  });

  it('ignores digit runs shorter than 13 digits', () => {
    const { report } = sanitize('ref 4111 1111 11 done', seedPolicy());
    expect(report.blocks).toEqual([]);
  });

  it('redact + mask_keep_last keeps last 4 when policy allows', () => {
    const { sanitized, report } = sanitize(
      'Card 4111 1111 1111 1111',
      policyWith({ credit_card: { mode: 'redact', style: 'mask_keep_last', keepLastDigits: 4 } }),
    );
    expect(report.blocks).toEqual([]);
    expect(sanitized).toBe('Card **** **** **** 1111');
  });
});

describe('customer name hashing', () => {
  it('hashes seeded customer names deterministically (12 hex chars)', () => {
    const a = sanitize('Handoff from Jane Doe yesterday.', seedPolicy());
    const b = sanitize('Jane Doe approved this.', seedPolicy());
    expect(a.report.redactions).toBe(1);
    const tokenA = a.sanitized.match(/[0-9a-f]{12}/)?.[0];
    const tokenB = b.sanitized.match(/[0-9a-f]{12}/)?.[0];
    expect(tokenA).toMatch(/^[0-9a-f]{12}$/);
    expect(tokenA).toBe(tokenB);
    expect(a.sanitized).not.toContain('Jane Doe');
    expect(JSON.stringify(a.report)).not.toContain('Jane Doe');
  });
});

describe('report safety', () => {
  it('never contains raw PII for a mixed nasty payload', () => {
    const payload =
      'Email jane.doe@acme-corp.com or jane [at] acme [dot] com, phone +1-415-555-0132, ' +
      'SSN 123-45-6789, card 4111-1111-1111-1111, customer John Smith.';
    const { sanitized, report } = sanitize(payload, seedPolicy());
    const reportJson = JSON.stringify(report);
    for (const raw of ['jane.doe@acme-corp.com', '415-555-0132', '123-45-6789', '4111', 'John Smith']) {
      expect(reportJson).not.toContain(raw);
    }
    expect(report.blocks).toContain('ssn');
    expect(report.blocks).toContain('credit_card');
    expect(report.redactions).toBeGreaterThanOrEqual(3);
    void sanitized;
  });

  it('passes clean text through untouched', () => {
    const text = 'Refactor pagination cursor to (createdAt, id).';
    const { sanitized, report } = sanitize(text, seedPolicy());
    expect(sanitized).toBe(text);
    expect(report).toEqual({ redactions: 0, blocks: [] });
  });
});
