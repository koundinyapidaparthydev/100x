/**
 * PII firewall — mandatory gate in front of every model call (docs/security/PII_RESTRICTIONS.md).
 *
 * Modes come from the tenant Policy:
 *   redact → replace with a stable placeholder ([EMAIL_1], …)
 *   block  → refuse the AI job entirely (report carries CATEGORY NAMES ONLY)
 *   hash   → irreversible correlation token (sha256, first 12 hex chars)
 *   allow  → pass through untouched
 *
 * Hard rule: the report NEVER contains raw PII — only counts and category names.
 */

import { createHash } from 'node:crypto';
import type { PiiCategory, PiiMode, PiiReport, Policy } from '../../shared/types';

/** Configurable end-customer names seeded into the org policy (demo extension of the Policy type). */
export function customerNamesFromPolicy(policy: Policy): string[] {
  const extra = policy as Policy & { customerNames?: unknown };
  return Array.isArray(extra.customerNames)
    ? (extra.customerNames as unknown[]).filter((n): n is string => typeof n === 'string')
    : [];
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

// Zero-width chars attackers hide inside tokens. Each repeat consumes exactly
// one visible char, so matching stays linear (no catastrophic backtracking).
const ZW = '[\\u200B\\u200C\\u200D\\uFEFF]?';
const EMAIL_LOCAL = `(?:${ZW}[A-Za-z0-9._%+-])+`;
const EMAIL_DOMAIN_SEG = `(?:${ZW}[A-Za-z0-9-])+`;
// Obfuscation: only bracketed separators ("[at]", "(dot)", …). Bare words
// "at"/"dot" are NOT treated as separators — they cause false positives
// ("Reach me at jane.doe@x.com" would otherwise eat "me at jane.doe").
const EMAIL_AT = '(?:@|\\[at\\]|\\(at\\)|\\{at\\})';
const EMAIL_DOT = '(?:\\.|\\[dot\\]|\\(dot\\)|\\{dot\\})';
// Gaps between segments may contain whitespace AND zero-width chars.
const EMAIL_GAP = '[\\s\\u200B\\u200C\\u200D\\uFEFF]*';

/** Normal email, or obfuscated "name [at] host [dot] tld". */
const EMAIL_RE = new RegExp(
  `${EMAIL_LOCAL}${EMAIL_GAP}${EMAIL_AT}${EMAIL_GAP}${EMAIL_DOMAIN_SEG}(?:${EMAIL_GAP}${EMAIL_DOT}${EMAIL_GAP}${EMAIL_DOMAIN_SEG})+`,
  'gi',
);

/** Intl + US phone formats: +1-415-555-0132, (415) 555-0132, 415.555.0132 … */
const PHONE_RE = new RegExp(
  `(?<![\\w])(?:\\+?1[\\s.\\-]?)?(?:\\(\\d{3}\\)|\\d{3})[\\s.\\-]?\\d{3}[\\s.\\-]\\d{4}(?![\\w])` +
    `|(?<![\\w])\\+\\d{1,3}[\\s.\\-]\\d{2,4}[\\s.\\-]\\d{3,4}[\\s.\\-]\\d{3,4}(?![\\w])`,
  'g',
);

/** SSN: ###-##-####, or 9 consecutive digits with non-digit boundaries. */
const SSN_RE = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)|(?<![\d])\d{9}(?![\d])/g;

/** Card candidate: 13–19 digits, spaces/dashes allowed between groups. Luhn-checked separately. */
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

  // Sort: leftmost first; for ties, longest first. Drop overlapping losers.
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
 * Scan `text` against the policy's per-category modes.
 *
 * If any category in 'block' mode matched, `report.blocks` lists those
 * category names (deduped, NO raw values) and callers MUST NOT use
 * `sanitized` for a model call.
 */
export function sanitize(text: string, policy: Policy): SanitizeResult {
  const names = customerNamesFromPolicy(policy);
  const matches = detect(text, names);

  const blocks: string[] = [];
  let redactions = 0;

  // Apply replacements right-to-left so earlier offsets stay valid.
  let sanitized = text;
  const ordered = [...matches].sort((a, b) => b.start - a.start);

  for (const m of matches) {
    const mode: PiiMode = policy.pii[m.category];
    if (mode === 'block' && !blocks.includes(m.category)) blocks.push(m.category);
  }

  for (const m of ordered) {
    const mode: PiiMode = policy.pii[m.category];
    let replacement: string | null = null;
    switch (mode) {
      case 'redact': {
        // Number placeholders per category in reading order (left→right).
        const seenBefore = matches
          .filter((x) => x.category === m.category && x.start < m.start)
          .length;
        replacement = `[${PLACEHOLDER[m.category]}_${seenBefore + 1}]`;
        redactions += 1;
        break;
      }
      case 'hash':
        replacement = hashValue(m.raw);
        redactions += 1;
        break;
      case 'block':
      case 'allow':
        replacement = null; // untouched
        break;
    }
    if (replacement !== null) {
      sanitized = sanitized.slice(0, m.start) + replacement + sanitized.slice(m.end);
    }
  }

  return { sanitized, report: { redactions, blocks } };
}
