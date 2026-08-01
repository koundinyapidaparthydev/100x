/**
 * PII / PCI firewall — mandatory gate in front of every model call
 * (docs/security/PII_RESTRICTIONS.md).
 *
 * Modes come from the tenant Policy (per category):
 *   redact → clear via configured style (placeholder / fixed / mask last / mask domain)
 *   block  → refuse the AI job entirely (report carries CATEGORY NAMES ONLY)
 *   hash   → irreversible correlation token (sha256, first 12 hex chars)
 *   allow  → pass through untouched
 *
 * Hard rule: the report NEVER contains raw PII — only counts and category names.
 */

import { createHash } from 'node:crypto';
import type { PiiCategory, PiiCategoryRule, PiiReport, Policy } from '../../shared/types';
import { normalizeCustomerNames, normalizePiiMap, normalizePiiRule } from '../../shared/piiPolicy';

export function customerNamesFromPolicy(policy: Policy): string[] {
  return normalizeCustomerNames(policy.customerNames);
}

export function ruleFor(policy: Policy, category: PiiCategory): PiiCategoryRule {
  return normalizePiiRule(policy.pii?.[category], category);
}

export interface SanitizeResult {
  sanitized: string;
  report: PiiReport;
}

/** Luhn checksum for payment-card candidates. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Detectors. Patterns must tolerate zero-width spaces and common obfuscation
// ("jane [at] acme [dot] com", "555.123.4567") per PII_RESTRICTIONS.md testing
// requirements.
// ---------------------------------------------------------------------------

const ZW = '[\\u200B\\u200C\\u200D\\uFEFF]?';
const EMAIL_LOCAL = `(?:${ZW}[A-Za-z0-9._%+-])+`;
const EMAIL_DOMAIN_SEG = `(?:${ZW}[A-Za-z0-9-])+`;
const EMAIL_AT = '(?:@|\\[at\\]|\\(at\\)|\\{at\\})';
const EMAIL_DOT = '(?:\\.|\\[dot\\]|\\(dot\\)|\\{dot\\})';
const EMAIL_GAP = '[\\s\\u200B\\u200C\\u200D\\uFEFF]*';

const EMAIL_RE = new RegExp(
  `${EMAIL_LOCAL}${EMAIL_GAP}${EMAIL_AT}${EMAIL_GAP}${EMAIL_DOMAIN_SEG}(?:${EMAIL_GAP}${EMAIL_DOT}${EMAIL_GAP}${EMAIL_DOMAIN_SEG})+`,
  'gi',
);

const PHONE_RE = new RegExp(
  `(?<![\\w])(?:\\+?1[\\s.\\-]?)?(?:\\(\\d{3}\\)|\\d{3})[\\s.\\-]?\\d{3}[\\s.\\-]\\d{4}(?![\\w])` +
    `|(?<![\\w])\\+\\d{1,3}[\\s.\\-]\\d{2,4}[\\s.\\-]\\d{3,4}[\\s.\\-]\\d{3,4}(?![\\w])`,
  'g',
);

const SSN_RE = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)|(?<![\d])\d{9}(?![\d])/g;

const CARD_RE = /(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g;

const PLACEHOLDER: Record<PiiCategory, string> = {
  email: 'EMAIL',
  phone: 'PHONE',
  ssn: 'SSN',
  credit_card: 'CREDIT_CARD',
  customer_name: 'CUSTOMER_NAME',
};

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

interface Match {
  category: PiiCategory;
  start: number;
  end: number;
  raw: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keep last N digits; mask earlier digits with `*`, preserve separators. */
export function maskKeepLastDigits(raw: string, keepLast: number): string {
  const digits = raw.replace(/\D/g, '');
  const keep = Math.max(0, Math.min(keepLast, digits.length));
  const hideUntil = digits.length - keep;
  let digitIdx = 0;
  return raw.replace(/\d/g, () => {
    const i = digitIdx++;
    return i < hideUntil ? '*' : digits[i]!;
  });
}

/** `jane.doe@acme.com` → `***@acme.com` (normalizes obfuscated separators). */
export function maskKeepEmailDomain(raw: string): string {
  const normalized = raw
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .replace(/[\[({]\s*at\s*[\])}]/gi, '@')
    .replace(/[\[({]\s*dot\s*[\])}]/gi, '.');
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return '***@cleared.invalid';
  return `***${normalized.slice(at)}`;
}

function placeholderFor(category: PiiCategory, index: number): string {
  return `[${PLACEHOLDER[category]}_${index}]`;
}

/**
 * Build the cleared replacement for a match under `redact` mode.
 */
export function clearValue(
  category: PiiCategory,
  raw: string,
  rule: PiiCategoryRule,
  placeholderIndex: number,
): string {
  const style = rule.style ?? 'placeholder';
  switch (style) {
    case 'fixed': {
      const fixed = rule.fixedReplacement?.trim();
      return fixed || placeholderFor(category, placeholderIndex);
    }
    case 'mask_keep_last':
      return maskKeepLastDigits(raw, rule.keepLastDigits ?? 4);
    case 'mask_keep_domain':
      if (category === 'email') return maskKeepEmailDomain(raw);
      return placeholderFor(category, placeholderIndex);
    case 'placeholder':
    default:
      return placeholderFor(category, placeholderIndex);
  }
}

/**
 * Collect matches for all categories. Longest/leftmost wins when ranges
 * overlap so a card number isn't also counted as an SSN fragment.
 */
function detect(text: string, customerNames: string[]): Match[] {
  const matches: Match[] = [];

  for (const m of text.matchAll(new RegExp(EMAIL_RE.source, 'gi'))) {
    if (m.index !== undefined) {
      matches.push({ category: 'email', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
  }

  for (const m of text.matchAll(new RegExp(PHONE_RE.source, 'g'))) {
    if (m.index !== undefined) {
      matches.push({ category: 'phone', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
  }

  for (const m of text.matchAll(new RegExp(SSN_RE.source, 'g'))) {
    if (m.index !== undefined) {
      matches.push({ category: 'ssn', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
  }

  for (const m of text.matchAll(new RegExp(CARD_RE.source, 'g'))) {
    if (m.index === undefined) continue;
    const digits = m[0].replace(/[ -]/g, '');
    if (luhnValid(digits)) {
      matches.push({ category: 'credit_card', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
  }

  for (const name of customerNames) {
    if (!name.trim()) continue;
    const re = new RegExp(`(?<![\\w])${escapeRegExp(name)}(?![\\w])`, 'gi');
    for (const m of text.matchAll(re)) {
      if (m.index !== undefined) {
        matches.push({ category: 'customer_name', start: m.index, end: m.index + m[0].length, raw: m[0] });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      kept.push(m);
      lastEnd = m.end;
    }
  }
  return kept;
}

/**
 * Scan `text` against the policy's per-category modes / clearing styles.
 *
 * If any category in 'block' mode matched, `report.blocks` lists those
 * category names (deduped, NO raw values) and callers MUST NOT use
 * `sanitized` for a model call.
 */
export function sanitize(text: string, policy: Policy): SanitizeResult {
  const names = customerNamesFromPolicy(policy);
  const pii = normalizePiiMap(policy.pii);
  const matches = detect(text, names);

  const blocks: string[] = [];
  let redactions = 0;

  let sanitized = text;
  const ordered = [...matches].sort((a, b) => b.start - a.start);

  for (const m of matches) {
    const mode = pii[m.category].mode;
    if (mode === 'block' && !blocks.includes(m.category)) blocks.push(m.category);
  }

  for (const m of ordered) {
    const rule = pii[m.category];
    let replacement: string | null = null;
    switch (rule.mode) {
      case 'redact': {
        const seenBefore = matches.filter((x) => x.category === m.category && x.start < m.start).length;
        replacement = clearValue(m.category, m.raw, rule, seenBefore + 1);
        redactions += 1;
        break;
      }
      case 'hash':
        replacement = hashValue(m.raw);
        redactions += 1;
        break;
      case 'block':
      case 'allow':
        replacement = null;
        break;
    }
    if (replacement !== null) {
      sanitized = sanitized.slice(0, m.start) + replacement + sanitized.slice(m.end);
    }
  }

  return { sanitized, report: { redactions, blocks } };
}

/**
 * Secondary scan for board write-back: never leave blocked categories intact.
 * Categories configured as `block` are cleared with that category's redact style
 * (or placeholder) so comments/attachments do not echo raw PII/PCI.
 */
export function sanitizeForWriteback(text: string, policy: Policy): SanitizeResult {
  const pii = normalizePiiMap(policy.pii);
  const writeback: Policy = {
    ...policy,
    pii: Object.fromEntries(
      Object.entries(pii).map(([category, rule]) => [
        category,
        rule.mode === 'block' || rule.mode === 'allow'
          ? {
              ...rule,
              mode: 'redact' as const,
              style: rule.style ?? (category === 'email' ? 'fixed' : 'mask_keep_last'),
            }
          : rule,
      ]),
    ) as Policy['pii'],
    customerNames: customerNamesFromPolicy(policy),
  };
  return sanitize(text, writeback);
}

/** Merge two PII reports (e.g. ticket text + MCP snippets). */
export function mergePiiReports(a: PiiReport, b: PiiReport): PiiReport {
  const blocks = [...a.blocks];
  for (const cat of b.blocks) {
    if (!blocks.includes(cat)) blocks.push(cat);
  }
  return { redactions: a.redactions + b.redactions, blocks };
}
