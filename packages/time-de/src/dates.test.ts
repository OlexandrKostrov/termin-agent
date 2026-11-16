import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  BERLIN,
  dateInBerlin,
  instantInBerlin,
  isoWeekRange,
  speakBirthDate,
  speakBirthDateNumeric,
  speakDate,
  speakSlotStart,
} from './dates.js';

describe('instantInBerlin', () => {
  it('converts any offset to Berlin wall-clock time, across DST', () => {
    expect(instantInBerlin('2026-11-19T14:30:00Z').toFormat('HH:mm')).toBe('15:30'); // CET
    expect(instantInBerlin('2026-07-09T13:30:00Z').toFormat('HH:mm')).toBe('15:30'); // CEST
    expect(instantInBerlin('2026-11-19T15:30:00+01:00').zoneName).toBe(BERLIN);
  });

  it('rejects offset-less or invalid instants', () => {
    expect(() => instantInBerlin('2026-11-19T15:30:00')).toThrow(/offset/);
    expect(() => instantInBerlin('2026-02-30T10:00:00Z')).toThrow(RangeError);
  });
});

describe('dateInBerlin', () => {
  it('parses calendar dates strictly', () => {
    expect(dateInBerlin('2026-11-19').toISO()).toBe('2026-11-19T00:00:00.000+01:00');
    expect(() => dateInBerlin('19.11.2026')).toThrow(RangeError);
    expect(() => dateInBerlin('2026-13-01')).toThrow(RangeError);
  });
});

describe('isoWeekRange', () => {
  // Monday 16 Nov 2026
  const now = DateTime.fromISO('2026-11-16T10:00:00', { zone: BERLIN });

  it('resolves this week and next week', () => {
    expect(isoWeekRange(now, 0)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(isoWeekRange(now, 1)).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });

  it('uses Berlin time, not the instant UTC date', () => {
    // Sunday 23:30 UTC is already Monday in Berlin
    const lateSundayUtc = DateTime.fromISO('2026-11-22T23:30:00Z', { zone: 'utc' });
    expect(isoWeekRange(lateSundayUtc, 0)).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });

  it('crosses year boundaries', () => {
    const dec = DateTime.fromISO('2026-12-30T12:00:00', { zone: BERLIN });
    expect(isoWeekRange(dec, 1)).toEqual({ from: '2027-01-04', to: '2027-01-10' });
  });
});

describe('speaking dates', () => {
  it('speaks a date and slot start', () => {
    expect(speakDate(dateInBerlin('2026-11-19'))).toBe('Donnerstag, den neunzehnten November');
    expect(speakSlotStart('2026-12-03T14:30:00Z')).toBe(
      'am Donnerstag, den dritten Dezember, um fünfzehn Uhr dreißig',
    );
  });

  it('speaks a birth date', () => {
    expect(speakBirthDate('1988-03-14')).toBe('vierzehnter März neunzehnhundertachtundachtzig');
    expect(speakBirthDate('2001-07-01')).toBe('erster Juli zweitausendeins');
    expect(speakBirthDateNumeric('1988-03-14')).toBe(
      'vierzehn, drei, neunzehnhundertachtundachtzig',
    );
  });
});
