/**
 * Adversarial unit tests for the PII firewall (PII_RESTRICTIONS.md testing requirements).
 */

import { describe, expect, it } from 'vitest';
import type { Policy } from '../../shared/types';
import { luhnValid, sanitize } from './pii';
import { createSeedStore } from './store';

function seedPolicy(): Policy {
  return createSeedStore().policies[0]!;
}

/** Same as the seeded org policy but with chosen mode overrides. */
function policyWith(pii: Partial<Policy['pii']>): Policy {
  const base = seedPolicy();
  return { ...base, pii: { ...base.pii, ...pii } };
}

describe('email detection', () => {
  it('redacts a standard email with a placeholder', () => {
    const { sanitized, report } = sanitize('Reach me at jane.doe@acme-corp.com for details.', seedPolicy());
    expect(sanitized).toBe('Reach me at [EMAIL_1] for details.');
    expect(report).toEqual({ redactions: 1, blocks: [] });
    expect(sanitized).not.toContain('jane.doe@acme-corp.com');
  });

  it('redacts obfuscated "jane [at] acme [dot] com"', () => {
    const { sanitized, report } = sanitize('Contact jane [at] acme [dot] com please.', seedPolicy());
    expect(report.redactions).toBe(1);
    expect(sanitized).toContain('[EMAIL_1]');
    expect(sanitized.toLowerCase()).not.toContain('[at]');
  });

  it('redacts multiple emails with incrementing placeholders', () => {
    const { sanitized, report } = sanitize('a@x.com and b@y.org', seedPolicy());
    expect(report.redactions).toBe(2);
    expect(sanitized).toBe('[EMAIL_1] and [EMAIL_2]');
  });

  it('tolerates zero-width spaces inside an email', () => {
    const { sanitized, report } = sanitize('mail: jane\u200Bdoe@acme\u200B.com', seedPolicy());
    expect(report.redactions).toBe(1);
    expect(sanitized).not.toContain('acme\u200B.com');
  });
});

describe('phone detection', () => {
  const formats = ['+1-415-555-0132', '(415) 555-0132', '415.555.0132', '415-555-0132', '+1 415 555 0132'];
  for (const fmt of formats) {
    it(`redacts phone format "${fmt}"`, () => {
      const { sanitized, report } = sanitize(`Call ${fmt} now.`, seedPolicy());
      expect(report.redactions).toBe(1);
      expect(sanitized).toBe('Call [PHONE_1] now.');
    });
  }
});

describe('ssn detection (default mode: block)', () => {
  it('blocks on ###-##-#### and reports category name only', () => {
    const raw = '123-45-6789';
    const { sanitized, report } = sanitize(`Engineer SSN ${raw} from HR export.`, seedPolicy());
    expect(report.blocks).toEqual(['ssn']);
    // Report must never carry raw PII.
    expect(JSON.stringify(report)).not.toContain(raw);
    // Blocked categories are left untouched in the text — the caller must NOT use it.
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
    const { sanitized, report } = sanitize(`SSN ${raw}`, policyWith({ ssn: 'allow' }));
    expect(sanitized).toBe(`SSN ${raw}`);
    expect(report).toEqual({ redactions: 0, blocks: [] });
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
});

describe('customer name hashing', () => {
  it('hashes seeded customer names deterministically (12 hex chars)', () => {
    const a = sanitize('Handoff from Jane Doe yesterday.', seedPolicy());
    const b = sanitize('Jane Doe approved this.', seedPolicy());
    expect(a.report.redactions).toBe(1);
    const tokenA = a.sanitized.match(/[0-9a-f]{12}/)?.[0];
    const tokenB = b.sanitized.match(/[0-9a-f]{12}/)?.[0];
    expect(tokenA).toMatch(/^[0-9a-f]{12}$/);
    expect(tokenA).toBe(tokenB); // deterministic correlation token
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
    expect(report.redactions).toBeGreaterThanOrEqual(3); // emails + phone + name
    void sanitized;
  });

  it('passes clean text through untouched', () => {
    const text = 'Refactor pagination cursor to (createdAt, id).';
    const { sanitized, report } = sanitize(text, seedPolicy());
    expect(sanitized).toBe(text);
    expect(report).toEqual({ redactions: 0, blocks: [] });
  });
});
