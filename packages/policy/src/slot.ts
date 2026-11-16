import type { Constraints, Slot } from '@termin/domain';
import {
  MAX_HOLIDAY_YEAR,
  MIN_HOLIDAY_YEAR,
  formatHHmm,
  instantInBerlin,
  publicHolidayOn,
  type Bundesland,
  type IsoWeekday,
} from '@termin/time-de';

export type SlotViolation =
  | { readonly code: 'INVALID_SLOT'; readonly input: string }
  | { readonly code: 'IN_PAST'; readonly now: string }
  | { readonly code: 'BEFORE_RANGE'; readonly from: string }
  | { readonly code: 'AFTER_RANGE'; readonly to: string }
  | { readonly code: 'EXCLUDED_WEEKDAY'; readonly weekday: IsoWeekday }
  | { readonly code: 'EXCLUDED_DATE'; readonly date: string }
  | { readonly code: 'TOO_EARLY'; readonly earliestStart: string }
  | { readonly code: 'TOO_LATE'; readonly latestStart: string }
  | { readonly code: 'PUBLIC_HOLIDAY'; readonly name: string };

export type SlotViolationCode = SlotViolation['code'];

/** The slot as Berlin wall-clock values, for logs and confirmation read-back. */
export interface LocalSlot {
  readonly date: string;
  readonly time: string;
  readonly weekday: IsoWeekday;
}

export type SlotCheck =
  | { readonly ok: true; readonly local: LocalSlot }
  | { readonly ok: false; readonly violations: readonly SlotViolation[] };

export interface SlotContext {
  /** Current instant (ISO-8601 with offset). Injected, never read from the clock. */
  readonly now: string;
  /** Practice's federal state, for public holidays. Unknown → nationwide only. */
  readonly state?: Bundesland | undefined;
}

/**
 * The single gate for accepting an appointment. Returns *all* violations, so
 * the agent can explain a refusal ("Mittwoch passt leider nicht") and the
 * result can record why each offer was declined.
 *
 * Fails closed: an unparseable slot is a violation, not an exception.
 */
export function checkSlot(slot: Slot, constraints: Constraints, ctx: SlotContext): SlotCheck {
  let start;
  try {
    start = instantInBerlin(slot.start);
  } catch {
    return { ok: false, violations: [{ code: 'INVALID_SLOT', input: slot.start }] };
  }

  const date = start.toISODate();
  const time = formatHHmm({ hour: start.hour, minute: start.minute });
  const weekday = start.weekday;
  const violations: SlotViolation[] = [];

  if (start <= instantInBerlin(ctx.now)) violations.push({ code: 'IN_PAST', now: ctx.now });

  const { dateRange, earliestStart, latestStart, excludedWeekdays, excludedDates } = constraints;
  if (date < dateRange.from) violations.push({ code: 'BEFORE_RANGE', from: dateRange.from });
  if (date > dateRange.to) violations.push({ code: 'AFTER_RANGE', to: dateRange.to });
  if (excludedWeekdays.includes(weekday)) violations.push({ code: 'EXCLUDED_WEEKDAY', weekday });
  if (excludedDates.includes(date)) violations.push({ code: 'EXCLUDED_DATE', date });
  // Zero-padded HH:mm compares correctly as strings.
  if (earliestStart !== undefined && time < earliestStart) {
    violations.push({ code: 'TOO_EARLY', earliestStart });
  }
  if (latestStart !== undefined && time > latestStart) {
    violations.push({ code: 'TOO_LATE', latestStart });
  }

  // A holiday slot almost always means we misheard the date. Never book it blind.
  if (start.year >= MIN_HOLIDAY_YEAR && start.year <= MAX_HOLIDAY_YEAR) {
    const holiday = publicHolidayOn(date, ctx.state);
    if (holiday) violations.push({ code: 'PUBLIC_HOLIDAY', name: holiday.name });
  }

  return violations.length === 0
    ? { ok: true, local: { date, time, weekday } }
    : { ok: false, violations };
}

const WEEKDAYS_EN = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** English, user-facing explanation (stored in `declinedOffers[].reasons`). */
export function describeViolation(v: SlotViolation): string {
  switch (v.code) {
    case 'INVALID_SLOT':
      return `Could not interpret the offered time ("${v.input}")`;
    case 'IN_PAST':
      return 'The slot is in the past';
    case 'BEFORE_RANGE':
      return `Before your earliest date (${v.from})`;
    case 'AFTER_RANGE':
      return `After your latest date (${v.to})`;
    case 'EXCLUDED_WEEKDAY':
      return `You excluded ${WEEKDAYS_EN[v.weekday] ?? 'this weekday'}`;
    case 'EXCLUDED_DATE':
      return `You excluded ${v.date}`;
    case 'TOO_EARLY':
      return `Starts before ${v.earliestStart}`;
    case 'TOO_LATE':
      return `Starts after ${v.latestStart}`;
    case 'PUBLIC_HOLIDAY':
      return `Falls on a public holiday (${v.name}); likely a misunderstanding`;
  }
}
