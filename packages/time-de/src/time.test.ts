import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatHHmm, parseGermanTime, parseHHmm, readings, speakTime } from './time.js';

describe('speakTime', () => {
  it.each([
    [15, 30, 'fünfzehn Uhr dreißig'],
    [9, 0, 'neun Uhr'],
    [1, 5, 'ein Uhr fünf'],
    [0, 0, 'null Uhr'],
    [21, 1, 'einundzwanzig Uhr eins'],
  ])('%i:%i → %s', (h, m, words) => {
    expect(speakTime(h, m)).toBe(words);
  });

  it('rejects invalid times', () => {
    expect(() => speakTime(24, 0)).toThrow(RangeError);
    expect(() => speakTime(10, 60)).toThrow(RangeError);
  });
});

describe('parseGermanTime', () => {
  it.each([
    // 24-hour forms are unambiguous
    ['fünfzehn Uhr dreißig', 15, 30, false],
    ['15:30 Uhr', 15, 30, false],
    ['um 15.30', 15, 30, false],
    ['15 Uhr 30', 15, 30, false],
    ['siebzehn Uhr', 17, 0, false],
    ['Fuenfzehn Uhr Fuenfundvierzig', 15, 45, false],
    // colloquial 12-hour forms: likeliest practice-hours reading, flagged
    ['halb vier', 15, 30, true],
    ['Viertel nach drei', 15, 15, true],
    ['viertel vor vier', 15, 45, true],
    ['dreiviertel vier', 15, 45, true],
    ['drei viertel vier', 15, 45, true],
    ['viertel vier', 15, 15, true],
    ['zehn nach drei', 15, 10, true],
    ['zehn vor vier', 15, 50, true],
    ['fünf vor halb vier', 15, 25, true],
    ['fünf nach halb vier', 15, 35, true],
    ['um drei', 15, 0, true],
    ['um neun', 9, 0, true],
    ['halb zehn', 9, 30, true],
    ['halb eins', 12, 30, true],
    ['zwölf Uhr', 12, 0, true],
    // day-period words disambiguate
    ['halb vier nachmittags', 15, 30, false],
    ['morgens um acht', 8, 0, false],
    ['um neun Uhr abends', 21, 0, false],
    ['ein Uhr mittags', 13, 0, false],
    ['halb zwölf vormittags', 11, 30, false],
  ])('"%s" → %i:%i (ambiguous=%s)', (text, hour, minute, ambiguous) => {
    expect(parseGermanTime(text)).toEqual({ hour, minute, ambiguous });
  });

  it('finds the time inside a receptionist sentence', () => {
    expect(
      parseGermanTime('Also wir hätten am Donnerstag um Viertel vor vier noch was frei.'),
    ).toEqual({ hour: 15, minute: 45, ambiguous: true });
    expect(parseGermanTime('Am 21.11. um 16 Uhr ginge es.')).toEqual({
      hour: 16,
      minute: 0,
      ambiguous: false,
    });
  });

  it('prefers the fuller form after "um"', () => {
    expect(parseGermanTime('um fünfzehn Uhr dreißig')).toEqual({
      hour: 15,
      minute: 30,
      ambiguous: false,
    });
  });

  it('returns undefined when there is no time', () => {
    expect(parseGermanTime('Da muss ich mal schauen.')).toBeUndefined();
    expect(parseGermanTime('')).toBeUndefined();
  });

  it('round-trips every time the agent can speak', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (h, m) => {
        const parsed = parseGermanTime(speakTime(h, m));
        expect(parsed).toBeDefined();
        // Always among the plausible readings …
        expect(readings(parsed!)).toContainEqual({ hour: h, minute: m });
        // … and exact for every hour a practice is plausibly open, or > 12.
        if (h === 0 || h >= 7) expect(parsed).toMatchObject({ hour: h, minute: m });
      }),
    );
  });
});

describe('readings', () => {
  it('offers both halves of the day for ambiguous times', () => {
    expect(readings({ hour: 15, minute: 30, ambiguous: true })).toEqual([
      { hour: 15, minute: 30 },
      { hour: 3, minute: 30 },
    ]);
    expect(readings({ hour: 15, minute: 30, ambiguous: false })).toEqual([
      { hour: 15, minute: 30 },
    ]);
  });
});

describe('HH:mm', () => {
  it('formats and parses symmetrically', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (h, m) => {
        expect(parseHHmm(formatHHmm({ hour: h, minute: m }))).toEqual({ hour: h, minute: m });
      }),
    );
  });

  it('rejects malformed input', () => {
    expect(() => parseHHmm('9:00')).toThrow(RangeError);
    expect(() => parseHHmm('24:00')).toThrow(RangeError);
  });
});
