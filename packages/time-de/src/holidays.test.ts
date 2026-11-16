import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUNDESLAENDER, easterSunday, publicHolidayOn, publicHolidays } from './holidays.js';

describe('easterSunday', () => {
  it.each([
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('%i → %s', (year, date) => {
    expect(easterSunday(year).toISODate()).toBe(date);
  });

  it('is always a Sunday between 22 March and 25 April', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2018, max: 2099 }), (year) => {
        const e = easterSunday(year);
        expect(e.weekday).toBe(7);
        const date = e.toISODate();
        expect(date >= `${year}-03-22` && date <= `${year}-04-25`).toBe(true);
      }),
    );
  });
});

describe('publicHolidays', () => {
  it('returns the nine nationwide holidays without a state', () => {
    expect(publicHolidays(2026).map((h) => h.name)).toEqual([
      'Neujahr',
      'Karfreitag',
      'Ostermontag',
      'Tag der Arbeit',
      'Christi Himmelfahrt',
      'Pfingstmontag',
      'Tag der Deutschen Einheit',
      '1. Weihnachtstag',
      '2. Weihnachtstag',
    ]);
  });

  it('adds state holidays', () => {
    expect(publicHolidayOn('2026-06-04', 'BY')?.name).toBe('Fronleichnam');
    expect(publicHolidayOn('2026-06-04', 'BE')).toBeUndefined();
    expect(publicHolidayOn('2026-03-08', 'BE')?.name).toBe('Internationaler Frauentag');
    expect(publicHolidayOn('2026-10-31', 'HH')?.name).toBe('Reformationstag');
    expect(publicHolidayOn('2026-11-01', 'NW')?.name).toBe('Allerheiligen');
    expect(publicHolidayOn('2026-09-20', 'TH')?.name).toBe('Weltkindertag');
  });

  it('respects introduction years', () => {
    expect(publicHolidayOn('2022-03-08', 'MV')).toBeUndefined();
    expect(publicHolidayOn('2023-03-08', 'MV')?.name).toBe('Internationaler Frauentag');
  });

  it('computes Buß- und Bettag as a Wednesday between 16 and 22 November', () => {
    expect(publicHolidayOn('2026-11-18', 'SN')?.name).toBe('Buß- und Bettag');
    fc.assert(
      fc.property(fc.integer({ min: 2018, max: 2099 }), (year) => {
        const h = publicHolidays(year, 'SN').find((x) => x.name === 'Buß- und Bettag');
        expect(h).toBeDefined();
        const day = Number(h!.date.slice(8));
        expect(day >= 16 && day <= 22).toBe(true);
        expect(new Date(`${h!.date}T12:00:00Z`).getUTCDay()).toBe(3);
      }),
    );
  });

  it('every state is a superset of the nationwide list, sorted, no duplicates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2018, max: 2099 }),
        fc.constantFrom(...BUNDESLAENDER),
        (year, state) => {
          const all = publicHolidays(year, state).map((h) => h.date);
          const national = publicHolidays(year).map((h) => h.date);
          expect(all).toEqual(expect.arrayContaining(national));
          expect([...all].sort()).toEqual(all);
          expect(new Set(all).size).toBe(all.length);
        },
      ),
    );
  });

  it('rejects years outside the modelled range', () => {
    expect(() => publicHolidays(2017)).toThrow(RangeError);
    expect(() => publicHolidays(2100)).toThrow(RangeError);
  });
});
