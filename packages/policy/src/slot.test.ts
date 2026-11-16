import type { Constraints, Slot } from '@termin/domain';
import { publicHolidayOn, type IsoWeekday } from '@termin/time-de';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkSlot, describeViolation, type SlotViolationCode } from './slot.js';

// "Book me a GP appointment next week, after 15:00, not Wednesday", asked Mon 16 Nov 2026.
const NOW = '2026-11-16T10:00:00+01:00';
const NEXT_WEEK_AFTER_3_NOT_WED: Constraints = {
  dateRange: { from: '2026-11-23', to: '2026-11-29' },
  earliestStart: '15:00',
  excludedWeekdays: [3],
  excludedDates: [],
};

const codes = (slot: Slot, c: Constraints = NEXT_WEEK_AFTER_3_NOT_WED, now = NOW) => {
  const r = checkSlot(slot, c, { now, state: 'BE' });
  return r.ok ? [] : r.violations.map((v) => v.code);
};

describe('checkSlot: the README example', () => {
  it('accepts Thursday 15:30 and reports Berlin wall-clock values', () => {
    expect(
      checkSlot({ start: '2026-11-26T15:30:00+01:00' }, NEXT_WEEK_AFTER_3_NOT_WED, { now: NOW }),
    ).toEqual({
      ok: true,
      local: { date: '2026-11-26', time: '15:30', weekday: 4 },
    });
  });

  it('treats the earliest start as inclusive', () => {
    expect(codes({ start: '2026-11-24T15:00:00+01:00' })).toEqual([]);
    expect(codes({ start: '2026-11-24T14:59:00+01:00' })).toEqual(['TOO_EARLY']);
  });

  it('declines Wednesday, this week, and the week after', () => {
    expect(codes({ start: '2026-11-25T16:00:00+01:00' })).toEqual(['EXCLUDED_WEEKDAY']);
    expect(codes({ start: '2026-11-19T16:00:00+01:00' })).toEqual(['BEFORE_RANGE']);
    expect(codes({ start: '2026-11-30T16:00:00+01:00' })).toEqual(['AFTER_RANGE']);
  });

  it('reports every violation, not just the first', () => {
    expect(codes({ start: '2026-12-02T09:00:00+01:00' })).toEqual([
      'AFTER_RANGE',
      'EXCLUDED_WEEKDAY',
      'TOO_EARLY',
    ]);
  });

  it('evaluates instants in Berlin time whatever offset they carry', () => {
    expect(codes({ start: '2026-11-26T14:00:00Z' })).toEqual([]); // 15:00 CET
    expect(codes({ start: '2026-11-26T13:59:00Z' })).toEqual(['TOO_EARLY']);
    expect(codes({ start: '2026-11-26T09:00:00-05:00' })).toEqual([]); // 15:00 CET
  });

  it('handles DST: 15:00 in July is 13:00Z', () => {
    const july: Constraints = {
      ...NEXT_WEEK_AFTER_3_NOT_WED,
      dateRange: { from: '2027-07-05', to: '2027-07-09' },
    };
    expect(codes({ start: '2027-07-06T13:00:00Z' }, july)).toEqual([]);
    expect(codes({ start: '2027-07-06T12:59:00Z' }, july)).toEqual(['TOO_EARLY']);
  });
});

describe('checkSlot: other rules', () => {
  const december: Constraints = {
    dateRange: { from: '2026-12-21', to: '2026-12-31' },
    excludedWeekdays: [],
    excludedDates: ['2026-12-30'],
    latestStart: '17:00',
  };

  it('honours excluded dates and latest start (inclusive)', () => {
    expect(codes({ start: '2026-12-30T10:00:00+01:00' }, december)).toEqual(['EXCLUDED_DATE']);
    expect(codes({ start: '2026-12-29T17:00:00+01:00' }, december)).toEqual([]);
    expect(codes({ start: '2026-12-29T17:01:00+01:00' }, december)).toEqual(['TOO_LATE']);
  });

  it('flags public holidays as likely misunderstandings', () => {
    expect(codes({ start: '2026-12-25T10:00:00+01:00' }, december)).toEqual(['PUBLIC_HOLIDAY']);
  });

  it('rejects past slots', () => {
    expect(
      codes(
        { start: '2026-11-26T15:30:00+01:00' },
        NEXT_WEEK_AFTER_3_NOT_WED,
        '2026-11-26T15:30:00+01:00',
      ),
    ).toEqual(['IN_PAST']);
  });

  it('fails closed on garbage input', () => {
    expect(codes({ start: 'Donnerstag halb vier' })).toEqual(['INVALID_SLOT']);
    expect(codes({ start: '2026-11-26T15:30:00' })).toEqual(['INVALID_SLOT']); // no offset
  });

  it('has a distinct English explanation for every violation code', () => {
    const all = [
      { code: 'INVALID_SLOT', input: 'x' },
      { code: 'IN_PAST', now: NOW },
      { code: 'BEFORE_RANGE', from: '2026-11-23' },
      { code: 'AFTER_RANGE', to: '2026-11-29' },
      { code: 'EXCLUDED_WEEKDAY', weekday: 3 },
      { code: 'EXCLUDED_DATE', date: '2026-11-24' },
      { code: 'TOO_EARLY', earliestStart: '15:00' },
      { code: 'TOO_LATE', latestStart: '18:00' },
      { code: 'PUBLIC_HOLIDAY', name: 'Neujahr' },
    ] as const;
    const texts = all.map(describeViolation);
    expect(new Set(texts).size).toBe(all.length);
    for (const t of texts) expect(t.length).toBeGreaterThan(10);
  });

  it('explains each violation in English', () => {
    expect(describeViolation({ code: 'EXCLUDED_WEEKDAY', weekday: 3 })).toBe(
      'You excluded Wednesday',
    );
    expect(describeViolation({ code: 'TOO_EARLY', earliestStart: '15:00' })).toBe(
      'Starts before 15:00',
    );
  });
});

// ── Property test against an independent oracle ─────────────────────────────
// The oracle derives Berlin wall-clock values with Intl (not Luxon) and
// re-states every rule directly. Any disagreement is a bug in one of them.

const berlinFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
const WEEKDAY: Record<string, IsoWeekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function berlin(ms: number) {
  const p = Object.fromEntries(berlinFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    date: `${p['year']}-${p['month']}-${p['day']}`,
    time: `${p['hour']}:${p['minute']}`,
    weekday: WEEKDAY[p['weekday']!]!,
  };
}

function oracle(ms: number, c: Constraints, nowMs: number): Set<SlotViolationCode> {
  const { date, time, weekday } = berlin(ms);
  const out = new Set<SlotViolationCode>();
  if (ms <= nowMs) out.add('IN_PAST');
  if (date < c.dateRange.from) out.add('BEFORE_RANGE');
  if (date > c.dateRange.to) out.add('AFTER_RANGE');
  if (c.excludedWeekdays.includes(weekday)) out.add('EXCLUDED_WEEKDAY');
  if (c.excludedDates.includes(date)) out.add('EXCLUDED_DATE');
  if (c.earliestStart !== undefined && time < c.earliestStart) out.add('TOO_EARLY');
  if (c.latestStart !== undefined && time > c.latestStart) out.add('TOO_LATE');
  if (publicHolidayOn(date, 'BY')) out.add('PUBLIC_HOLIDAY');
  return out;
}

/** Renders an instant with an arbitrary fixed offset, e.g. "+05:30". */
function withOffset(ms: number, offsetMin: number): string {
  if (offsetMin === 0) return new Date(ms).toISOString().replace('.000Z', 'Z');
  const local = new Date(ms + offsetMin * 60_000).toISOString().slice(0, 19);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const DAY = 86_400_000;
const START_2026 = Date.UTC(2026, 0, 1);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const quarterHour = fc.integer({ min: 0, max: 95 }).map((q) => {
  const m = q * 15;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

const scenario = fc
  .record({
    fromDay: fc.integer({ min: 0, max: 5 * 365 }),
    span: fc.integer({ min: 0, max: 21 }),
    times: fc.tuple(
      fc.option(quarterHour, { nil: undefined }),
      fc.option(quarterHour, { nil: undefined }),
    ),
    excludedWeekdays: fc.uniqueArray(fc.constantFrom<IsoWeekday>(1, 2, 3, 4, 5, 6, 7), {
      maxLength: 4,
    }),
    excludedOffsets: fc.uniqueArray(fc.integer({ min: 0, max: 21 }), { maxLength: 3 }),
    slotDelta: fc.integer({ min: -3 * 288, max: 25 * 288 }), // 5-minute steps around the range
    offsetMin: fc.constantFrom(0, 60, 120, -300, 330, 545),
    nowDelta: fc.integer({ min: -40, max: 40 }),
  })
  .map((s) => {
    const fromMs = START_2026 + s.fromDay * DAY;
    const [a, b] = s.times;
    const [earliestStart, latestStart] =
      a !== undefined && b !== undefined && a > b ? [b, a] : [a, b];
    const constraints: Constraints = {
      dateRange: { from: isoDay(fromMs), to: isoDay(fromMs + s.span * DAY) },
      excludedWeekdays: s.excludedWeekdays,
      excludedDates: s.excludedOffsets.map((o) => isoDay(fromMs + o * DAY)),
      ...(earliestStart !== undefined && { earliestStart }),
      ...(latestStart !== undefined && { latestStart }),
    };
    const slotMs = fromMs + s.slotDelta * 5 * 60_000;
    return {
      constraints,
      slotMs,
      slot: { start: withOffset(slotMs, s.offsetMin) },
      nowMs: fromMs + s.nowDelta * DAY,
    };
  });

describe('checkSlot: properties', () => {
  it('agrees with an independent oracle on every violation', () => {
    fc.assert(
      fc.property(scenario, ({ constraints, slot, slotMs, nowMs }) => {
        const result = checkSlot(slot, constraints, {
          now: new Date(nowMs).toISOString(),
          state: 'BY',
        });
        const expected = oracle(slotMs, constraints, nowMs);
        const actual = new Set(result.ok ? [] : result.violations.map((v) => v.code));
        expect(actual).toEqual(expected);
        expect(result.ok).toBe(expected.size === 0);
      }),
      { numRuns: 2000 },
    );
  });

  it('tightening constraints never turns a rejection into an acceptance', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.constantFrom<IsoWeekday>(1, 2, 3, 4, 5, 6, 7),
        ({ constraints, slot, nowMs }, wd) => {
          const ctx = { now: new Date(nowMs).toISOString() };
          const before = checkSlot(slot, constraints, ctx);
          const tighter = {
            ...constraints,
            excludedWeekdays: [...constraints.excludedWeekdays, wd],
          };
          const after = checkSlot(slot, tighter, ctx);
          if (!before.ok) expect(after.ok).toBe(false);
        },
      ),
    );
  });
});
