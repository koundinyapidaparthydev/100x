import { describe, expect, it } from 'vitest';
import {
  defaultPiiMap,
  mergePiiUpdate,
  normalizeCustomerNames,
  normalizePiiRule,
} from './piiPolicy';

describe('normalizePiiRule', () => {
  it('expands legacy string modes', () => {
    const rule = normalizePiiRule('redact', 'email');
    expect(rule.mode).toBe('redact');
    expect(rule.style).toBe('fixed');
    expect(rule.fixedReplacement).toBe('user@cleared.invalid');
  });

  it('merges partial rule patches', () => {
    const next = mergePiiUpdate(defaultPiiMap(), {
      phone: { mode: 'redact', style: 'placeholder' },
      credit_card: { mode: 'redact', keepLastDigits: 4 },
    });
    expect(next.phone.style).toBe('placeholder');
    expect(next.credit_card.mode).toBe('redact');
    expect(next.credit_card.keepLastDigits).toBe(4);
  });
});

describe('normalizeCustomerNames', () => {
  it('trims, dedupes case-insensitively', () => {
    expect(normalizeCustomerNames([' Jane Doe ', 'jane doe', '', 'John'])).toEqual([
      'Jane Doe',
      'John',
    ]);
  });
});
