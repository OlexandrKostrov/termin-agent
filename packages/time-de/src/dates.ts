import { DateTime } from 'luxon';
import { cardinal, ordinal, year } from './numbers.js';
import { speakTime } from './time.js';

export const BERLIN = 'Europe/Berlin';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS_DE: Readonly<Record<IsoWeekday, string>> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
};

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

function monthName(month: number): string {
  const name = MONTHS_DE[month - 1];
  if (name === undefined) throw new RangeError(`Invalid month ${month}`);
  return name;
}

function ensureValid(dt: DateTime, input: string): DateTime<true> {
  if (!dt.isValid) {
    throw new RangeError(`Invalid date/time "${input}": ${dt.invalidExplanation ?? 'unknown'}`);
  }
  return dt as DateTime<true>;
}

/**
 * Parses an ISO-8601 instant (must carry an offset or Z) and returns it in
 * Europe/Berlin. Offset-less strings are rejected: their meaning depends on
 * the host's time zone.
 */
export function instantInBerlin(iso: string): DateTime<true> {
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    throw new RangeError(`Instant must include an offset or Z: "${iso}"`);
  }
  return ensureValid(DateTime.fromISO(iso, { setZone: true }), iso).setZone(
    BERLIN,
  ) as DateTime<true>;
}

/** Parses a calendar date ("2026-11-19") as midnight in Europe/Berlin. */
export function dateInBerlin(isoDate: string): DateTime<true> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate))
    throw new RangeError(`Expected YYYY-MM-DD: "${isoDate}"`);
  return ensureValid(DateTime.fromISO(isoDate, { zone: BERLIN }), isoDate);
}

export function toIsoDate(dt: DateTime<true>): string {
  return dt.toISODate();
}

export interface DateRange {
  /** Inclusive, YYYY-MM-DD. */
  readonly from: string;
  /** Inclusive, YYYY-MM-DD. */
  readonly to: string;
}

/**
 * Monday–Sunday of the ISO week `offsetWeeks` away from `now` (in Berlin).
 * "this week" = 0, "next week" = 1.
 */
export function isoWeekRange(now: DateTime, offsetWeeks: number): DateRange {
  if (!Number.isInteger(offsetWeeks)) throw new RangeError('offsetWeeks must be an integer');
  const monday = now.setZone(BERLIN).startOf('week').plus({ weeks: offsetWeeks });
  const sunday = monday.plus({ days: 6 });
  return { from: monday.toISODate() ?? '', to: sunday.toISODate() ?? '' };
}

/** "Donnerstag, den einundzwanzigsten November" */
export function speakDate(date: DateTime<true>): string {
  const d = date.setZone(BERLIN);
  return `${WEEKDAYS_DE[d.weekday as IsoWeekday]}, den ${ordinal(d.day)} ${monthName(d.month)}`;
}

/** "am Donnerstag, den einundzwanzigsten November, um fünfzehn Uhr dreißig" */
export function speakSlotStart(startIso: string): string {
  const d = instantInBerlin(startIso);
  return `am ${speakDate(d)}, um ${speakTime(d.hour, d.minute)}`;
}

/** Birth date as dictated: "vierzehnter März neunzehnhundertachtundachtzig". */
export function speakBirthDate(isoDate: string): string {
  const d = dateInBerlin(isoDate);
  return `${ordinal(d.day, 'er')} ${monthName(d.month)} ${year(d.year)}`;
}

/** Birth date in numeric dictation: "vierzehn, drei, neunzehnhundertachtundachtzig". */
export function speakBirthDateNumeric(isoDate: string): string {
  const d = dateInBerlin(isoDate);
  return `${cardinal(d.day)}, ${cardinal(d.month)}, ${year(d.year)}`;
}
