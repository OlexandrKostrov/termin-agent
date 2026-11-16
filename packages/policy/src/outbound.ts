import { DomainError, e164Schema } from '@termin/domain';

export type OutboundCheck =
  | { readonly ok: true; readonly number: string }
  | {
      readonly ok: false;
      readonly reason: 'invalid_number' | 'empty_allow_list' | 'not_allow_listed';
    };

/**
 * MVP safety rail: the agent may only dial numbers on an explicit allow-list
 * (the simulated practice and the author's own phones). Exact E.164 match,
 * with no normalisation, so the comparison has no clever edge cases.
 */
export function checkOutboundNumber(number: string, allowList: readonly string[]): OutboundCheck {
  if (!e164Schema.safeParse(number).success) return { ok: false, reason: 'invalid_number' };
  if (allowList.length === 0) return { ok: false, reason: 'empty_allow_list' };
  if (!allowList.includes(number)) return { ok: false, reason: 'not_allow_listed' };
  return { ok: true, number };
}

/** Throws `POLICY_VIOLATION` unless the number may be dialled. */
export function assertOutboundAllowed(number: string, allowList: readonly string[]): void {
  const check = checkOutboundNumber(number, allowList);
  if (!check.ok) {
    throw new DomainError('POLICY_VIOLATION', 'Outbound number is not allowed', {
      reason: check.reason,
    });
  }
}

/**
 * Parses `OUTBOUND_ALLOWLIST` ("+49301,+49302"). Invalid entries fail
 * loudly at startup rather than being silently dropped.
 */
export function parseAllowList(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const invalid = entries.filter((e) => !e164Schema.safeParse(e).success);
  if (invalid.length > 0) {
    throw new DomainError('VALIDATION_FAILED', 'OUTBOUND_ALLOWLIST contains invalid numbers', {
      invalid,
    });
  }
  return [...new Set(entries)];
}
