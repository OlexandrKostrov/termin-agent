import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cardinal, ordinal, parseNumberToken, phoneDigit, year } from './numbers.js';

describe('cardinal', () => {
  it.each([
    [0, 'null'],
    [1, 'eins'],
    [12, 'zwölf'],
    [16, 'sechzehn'],
    [17, 'siebzehn'],
    [21, 'einundzwanzig'],
    [30, 'dreißig'],
    [45, 'fünfundvierzig'],
    [100, 'einhundert'],
    [101, 'einhunderteins'],
    [999, 'neunhundertneunundneunzig'],
    [2026, 'zweitausendsechsundzwanzig'],
  ])('%i → %s', (n, words) => {
    expect(cardinal(n)).toBe(words);
  });

  it('rejects out-of-range and non-integers', () => {
    expect(() => cardinal(-1)).toThrow(RangeError);
    expect(() => cardinal(10_000)).toThrow(RangeError);
    expect(() => cardinal(1.5)).toThrow(RangeError);
  });
});

describe('year', () => {
  it.each([
    [1988, 'neunzehnhundertachtundachtzig'],
    [1900, 'neunzehnhundert'],
    [2000, 'zweitausend'],
    [2005, 'zweitausendfünf'],
  ])('%i → %s', (n, words) => {
    expect(year(n)).toBe(words);
  });
});

describe('ordinal', () => {
  it.each([
    [1, 'ersten'],
    [2, 'zweiten'],
    [3, 'dritten'],
    [7, 'siebten'],
    [8, 'achten'],
    [16, 'sechzehnten'],
    [20, 'zwanzigsten'],
    [21, 'einundzwanzigsten'],
    [31, 'einunddreißigsten'],
  ])('%i → %s', (n, words) => {
    expect(ordinal(n)).toBe(words);
  });

  it('supports other endings', () => {
    expect(ordinal(14, 'er')).toBe('vierzehnter');
    expect(ordinal(1, 'e')).toBe('erste');
  });
});

describe('parseNumberToken', () => {
  it('inverts cardinal for 0–59, with and without umlauts', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (n) => {
        const words = cardinal(n);
        expect(parseNumberToken(words)).toBe(n);
        expect(parseNumberToken(words.toUpperCase())).toBe(n);
      }),
    );
    expect(parseNumberToken('fuenfzehn')).toBe(15);
    expect(parseNumberToken('dreissig')).toBe(30);
  });

  it('handles "ein", "zwo" and digits; rejects other words', () => {
    expect(parseNumberToken('ein')).toBe(1);
    expect(parseNumberToken('zwo')).toBe(2);
    expect(parseNumberToken('15')).toBe(15);
    expect(parseNumberToken('uhr')).toBeUndefined();
  });
});

describe('phoneDigit', () => {
  it('uses "zwo" for 2', () => {
    expect(phoneDigit(2)).toBe('zwo');
    expect(() => phoneDigit(10)).toThrow(RangeError);
  });
});
