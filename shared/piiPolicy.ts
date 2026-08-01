/**
 * PII/PCI policy helpers — normalize rules, merge patches, and pick defaults.
 * Used by backend firewall + web compliance settings.
 */

import type { PiiCategory, PiiCategoryRule, PiiMode, PiiRedactionStyle } from './types';

export const PII_CATEGORIES: PiiCategory[] = [
  'email',
  'phone',
  'ssn',
  'credit_card',
  'customer_name',
];

export const PII_REDACTION_STYLES: PiiRedactionStyle[] = [
  'placeholder',
  'fixed',
  'mask_keep_last',
  'mask_keep_domain',
];

/** Styles that make sense for a given category (UI filters). */
export function stylesForCategory(category: PiiCategory): PiiRedactionStyle[] {
  switch (category) {
    case 'email':
      return ['placeholder', 'fixed', 'mask_keep_domain'];
    case 'phone':
    case 'ssn':
    case 'credit_card':
      return ['placeholder', 'fixed', 'mask_keep_last'];
    case 'customer_name':
      return ['placeholder', 'fixed'];
  }
}

/** Org defaults aligned with docs/security/PII_RESTRICTIONS.md. */
export function defaultPiiRule(category: PiiCategory): PiiCategoryRule {
  switch (category) {
    case 'email':
      return {
        mode: 'redact',
        style: 'fixed',
        fixedReplacement: 'user@cleared.invalid',
      };
    case 'phone':
      return { mode: 'redact', style: 'mask_keep_last', keepLastDigits: 4 };
    case 'ssn':
      return { mode: 'block' };
    case 'credit_card':
      return { mode: 'block', style: 'mask_keep_last', keepLastDigits: 4 };
    case 'customer_name':
      return { mode: 'hash' };
  }
}

export function defaultPiiMap(): Record<PiiCategory, PiiCategoryRule> {
  return {
    email: defaultPiiRule('email'),
    phone: defaultPiiRule('phone'),
    ssn: defaultPiiRule('ssn'),
    credit_card: defaultPiiRule('credit_card'),
    customer_name: defaultPiiRule('customer_name'),
  };
}

/** Accept legacy string modes or partial rule objects from API / older seeds. */
export function normalizePiiRule(
  input: PiiMode | PiiCategoryRule | undefined,
  category: PiiCategory,
): PiiCategoryRule {
  const defaults = defaultPiiRule(category);
  if (input == null) return { ...defaults };
  if (typeof input === 'string') {
    return {
      ...defaults,
      mode: input,
      style: input === 'redact' ? defaults.style : defaults.style,
      fixedReplacement: defaults.fixedReplacement,
      keepLastDigits: defaults.keepLastDigits,
    };
  }
  const mode = input.mode ?? defaults.mode;
  const style =
    input.style ??
    (mode === 'redact' ? defaults.style : defaults.style);
  return {
    mode,
    style,
    fixedReplacement:
      typeof input.fixedReplacement === 'string' && input.fixedReplacement.trim()
        ? input.fixedReplacement.trim()
        : defaults.fixedReplacement,
    keepLastDigits:
      typeof input.keepLastDigits === 'number' && Number.isFinite(input.keepLastDigits)
        ? Math.max(0, Math.min(8, Math.floor(input.keepLastDigits)))
        : (defaults.keepLastDigits ?? 4),
  };
}

export function normalizePiiMap(
  pii: Partial<Record<PiiCategory, PiiMode | PiiCategoryRule>> | undefined,
): Record<PiiCategory, PiiCategoryRule> {
  const out = defaultPiiMap();
  if (!pii) return out;
  for (const category of PII_CATEGORIES) {
    if (pii[category] !== undefined) {
      out[category] = normalizePiiRule(pii[category], category);
    }
  }
  return out;
}

/** Deep-merge a PATCH body into the current org PII map. */
export function mergePiiUpdate(
  current: Record<PiiCategory, PiiCategoryRule>,
  patch: Partial<Record<PiiCategory, PiiMode | PiiCategoryRule>>,
): Record<PiiCategory, PiiCategoryRule> {
  const next = { ...current };
  for (const category of PII_CATEGORIES) {
    const incoming = patch[category];
    if (incoming === undefined) continue;
    if (typeof incoming === 'string') {
      next[category] = normalizePiiRule(
        { ...current[category], mode: incoming },
        category,
      );
    } else {
      next[category] = normalizePiiRule(
        { ...current[category], ...incoming },
        category,
      );
    }
  }
  return next;
}

export function normalizeCustomerNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of names) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
