import { DateTime } from 'luxon';
import { BERLIN } from './dates.js';

/** German federal states (ISO 3166-2:DE suffixes). */
export const BUNDESLAENDER = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;
export type Bundesland = (typeof BUNDESLAENDER)[number];

export interface Holiday {
  /** YYYY-MM-DD */
  readonly date: string;
  readonly name: string;
}

/** Earliest year whose holiday set is modelled (northern Reformationstag became permanent in 2018). */
export const MIN_HOLIDAY_YEAR = 2018;
export const MAX_HOLIDAY_YEAR = 2099;

/** Easter Sunday (Gregorian), anonymous Gregorian algorithm. */
export function easterSunday(y: number): DateTime<true> {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return DateTime.fromObject({ year: y, month, day }, { zone: BERLIN }) as DateTime<true>;
}

interface Rule {
  readonly name: string;
  readonly date: (year: number, easter: DateTime<true>) => DateTime<true>;
  /** `'all'` = nationwide. */
  readonly states: 'all' | readonly Bundesland[];
  readonly since?: number;
}

const fixed =
  (month: number, day: number) =>
  (year: number): DateTime<true> =>
    DateTime.fromObject({ year, month, day }, { zone: BERLIN }) as DateTime<true>;
const easterOffset =
  (days: number) =>
  (_: number, easter: DateTime<true>): DateTime<true> =>
    easter.plus({ days });

/** Buß- und Bettag: the last Wednesday before 23 November. */
const bussUndBettag = (year: number): DateTime<true> => {
  const nov22 = fixed(11, 22)(year);
  return nov22.minus({ days: (nov22.weekday - 3 + 7) % 7 });
};

/**
 * Statutory public holidays. Holidays that apply only in parts of a state
 * (Fronleichnam in parts of SN/TH, Mariä Himmelfahrt in Catholic BY
 * municipalities, Augsburger Friedensfest) are deliberately omitted. For those
 * the practice's own answer wins over our calendar.
 */
const RULES: readonly Rule[] = [
  { name: 'Neujahr', date: fixed(1, 1), states: 'all' },
  { name: 'Heilige Drei Könige', date: fixed(1, 6), states: ['BW', 'BY', 'ST'] },
  { name: 'Internationaler Frauentag', date: fixed(3, 8), states: ['BE'], since: 2019 },
  { name: 'Internationaler Frauentag', date: fixed(3, 8), states: ['MV'], since: 2023 },
  { name: 'Karfreitag', date: easterOffset(-2), states: 'all' },
  { name: 'Ostersonntag', date: easterOffset(0), states: ['BB'] },
  { name: 'Ostermontag', date: easterOffset(1), states: 'all' },
  { name: 'Tag der Arbeit', date: fixed(5, 1), states: 'all' },
  { name: 'Christi Himmelfahrt', date: easterOffset(39), states: 'all' },
  { name: 'Pfingstsonntag', date: easterOffset(49), states: ['BB'] },
  { name: 'Pfingstmontag', date: easterOffset(50), states: 'all' },
  {
    name: 'Fronleichnam',
    date: easterOffset(60),
    states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
  },
  { name: 'Mariä Himmelfahrt', date: fixed(8, 15), states: ['SL'] },
  { name: 'Weltkindertag', date: fixed(9, 20), states: ['TH'], since: 2019 },
  { name: 'Tag der Deutschen Einheit', date: fixed(10, 3), states: 'all' },
  {
    name: 'Reformationstag',
    date: fixed(10, 31),
    states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
  },
  { name: 'Allerheiligen', date: fixed(11, 1), states: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { name: 'Buß- und Bettag', date: bussUndBettag, states: ['SN'] },
  { name: '1. Weihnachtstag', date: fixed(12, 25), states: 'all' },
  { name: '2. Weihnachtstag', date: fixed(12, 26), states: 'all' },
];

/**
 * Public holidays for a year. Without `state`, returns only nationwide
 * holidays (a safe lower bound when the practice's state is unknown).
 */
export function publicHolidays(year: number, state?: Bundesland): Holiday[] {
  if (!Number.isInteger(year) || year < MIN_HOLIDAY_YEAR || year > MAX_HOLIDAY_YEAR) {
    throw new RangeError(
      `Holidays are modelled for ${MIN_HOLIDAY_YEAR}–${MAX_HOLIDAY_YEAR}, got ${year}`,
    );
  }
  const easter = easterSunday(year);
  return RULES.filter(
    (r) =>
      (r.since === undefined || year >= r.since) &&
      (r.states === 'all' || (state !== undefined && r.states.includes(state))),
  )
    .map((r) => ({ date: r.date(year, easter).toISODate(), name: r.name }))
    .sort((x, y) => x.date.localeCompare(y.date));
}

/** The public holiday on `isoDate` (YYYY-MM-DD), if any. */
export function publicHolidayOn(isoDate: string, state?: Bundesland): Holiday | undefined {
  const year = Number(isoDate.slice(0, 4));
  return publicHolidays(year, state).find((h) => h.date === isoDate);
}
