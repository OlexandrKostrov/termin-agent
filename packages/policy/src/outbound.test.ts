import { DomainError } from '@termin/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertOutboundAllowed, checkOutboundNumber, parseAllowList } from './outbound.js';

const SIM = '+4930000000000';
const MINE = '+4915112345678';

describe('checkOutboundNumber', () => {
  it('allows only exact allow-list matches', () => {
    expect(checkOutboundNumber(SIM, [SIM, MINE])).toEqual({ ok: true, number: SIM });
    expect(checkOutboundNumber('+4930000000001', [SIM])).toEqual({
      ok: false,
      reason: 'not_allow_listed',
    });
  });

  it('denies everything when the allow-list is empty', () => {
    expect(checkOutboundNumber(SIM, [])).toEqual({ ok: false, reason: 'empty_allow_list' });
  });

  it('rejects non-E.164 input before matching (no normalisation tricks)', () => {
    for (const n of ['030000000000', '+49 30 000000000', '+49-30000000000', '', '+0123456789']) {
      expect(checkOutboundNumber(n, [SIM, n])).toEqual({ ok: false, reason: 'invalid_number' });
    }
  });

  it('never allows a number that is not on the list', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^\+[1-9]\d{7,13}$/), { maxLength: 5 }),
        fc.stringMatching(/^\+[1-9]\d{7,13}$/),
        (list, n) => {
          expect(checkOutboundNumber(n, list).ok).toBe(list.includes(n));
        },
      ),
    );
  });
});

describe('assertOutboundAllowed', () => {
  it('throws POLICY_VIOLATION with the reason', () => {
    expect(() => {
      assertOutboundAllowed(SIM, [SIM]);
    }).not.toThrow();
    try {
      assertOutboundAllowed(MINE, [SIM]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).toAppError()).toEqual({
        code: 'POLICY_VIOLATION',
        message: 'Outbound number is not allowed',
        details: { reason: 'not_allow_listed' },
      });
    }
  });
});

describe('parseAllowList', () => {
  it('splits, trims and de-duplicates', () => {
    expect(parseAllowList(` ${SIM}, ${MINE},,${SIM} `)).toEqual([SIM, MINE]);
    expect(parseAllowList(undefined)).toEqual([]);
    expect(parseAllowList('')).toEqual([]);
  });

  it('fails loudly on invalid entries', () => {
    expect(() => parseAllowList(`${SIM},030123`)).toThrow(DomainError);
  });
});
