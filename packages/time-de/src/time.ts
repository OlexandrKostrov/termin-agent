import { cardinal, normalizeGerman, parseNumberToken } from './numbers.js';

/** A wall-clock time in Europe/Berlin. */
export interface ClockTime {
  readonly hour: number;
  readonly minute: number;
}

export interface ParsedTime extends ClockTime {
  /**
   * True when the utterance was a 12-hour form with no day-period word
   * ("halb vier", "um drei"). `hour` then holds the likelier reading during
   * practice hours. The agent must confirm it with the receptionist.
   */
  readonly ambiguous: boolean;
}

function assertClock(hour: number, minute: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    throw new RangeError(`Invalid hour ${hour}`);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`Invalid minute ${minute}`);
  }
}

/**
 * Speaks a time in unambiguous 24-hour form, as the agent should:
 * 15:30 → "fünfzehn Uhr dreißig", 9:00 → "neun Uhr", 1:05 → "ein Uhr fünf".
 */
export function speakTime(hour: number, minute: number): string {
  assertClock(hour, minute);
  const h = hour === 1 ? 'ein' : cardinal(hour);
  return minute === 0 ? `${h} Uhr` : `${h} Uhr ${cardinal(minute)}`;
}

/** "15:05" style formatting for logs and structured output. */
export function formatHHmm({ hour, minute }: ClockTime): string {
  assertClock(hour, minute);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parses "HH:mm" (24h). Throws on malformed input. */
export function parseHHmm(value: string): ClockTime {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Expected HH:mm, got "${value}"`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  assertClock(hour, minute);
  return { hour, minute };
}

type DayPeriod = 'am' | 'pm' | 'noon';

const DAY_PERIODS: readonly (readonly [RegExp, DayPeriod])[] = [
  [/\b(morgens|frueh|vormittags)\b/, 'am'],
  [/\b(nachmittags|abends)\b/, 'pm'],
  [/\bmittags\b/, 'noon'],
];

/** A raw match: `hour` as said, possibly on a 12-hour clock. */
type RawTime = ClockTime;

type Token = string | number;
type Pattern = (t: readonly Token[], i: number) => RawTime | undefined;

const isNum = (t: Token | undefined): t is number => typeof t === 'number';
/** Hour preceding hour N in colloquial forms ("halb vier" → 3); "halb eins" → 12. */
const prev = (n: number): number => (n === 1 ? 12 : n - 1);
const hour12 = (n: number): boolean => n >= 1 && n <= 12;

/**
 * Patterns are tried in order at each position. More specific forms come
 * first ("fünf vor halb vier" must win over "fünf vor …").
 */
const PATTERNS: readonly Pattern[] = [
  // 15:30, 15.30 (digits joined by STT)
  (t, i) => {
    const [h, sep, m] = [t[i], t[i + 1], t[i + 2]];
    if (isNum(h) && sep === ':' && isNum(m)) return { hour: h, minute: m };
    return undefined;
  },
  // "fünf vor halb vier" → 3:25 / "fünf nach halb vier" → 3:35
  (t, i) => {
    const [m, dir, halb, h] = [t[i], t[i + 1], t[i + 2], t[i + 3]];
    if (isNum(m) && (dir === 'vor' || dir === 'nach') && halb === 'halb' && isNum(h) && hour12(h)) {
      return { hour: prev(h), minute: dir === 'vor' ? 30 - m : 30 + m };
    }
    return undefined;
  },
  // "halb vier" → 3:30
  (t, i) => {
    const h = t[i + 1];
    if (t[i] === 'halb' && isNum(h) && hour12(h)) {
      return { hour: prev(h), minute: 30 };
    }
    return undefined;
  },
  // "viertel nach drei" → 3:15 / "viertel vor vier" → 3:45
  (t, i) => {
    const [dir, h] = [t[i + 1], t[i + 2]];
    if (t[i] === 'viertel' && (dir === 'nach' || dir === 'vor') && isNum(h) && hour12(h)) {
      return dir === 'nach' ? { hour: h, minute: 15 } : { hour: prev(h), minute: 45 };
    }
    return undefined;
  },
  // "dreiviertel vier" / "drei viertel vier" → 3:45 (regional)
  (t, i) => {
    if (t[i] === 'dreiviertel' && isNum(t[i + 1]) && hour12(t[i + 1] as number)) {
      return { hour: prev(t[i + 1] as number), minute: 45 };
    }
    if (t[i] === 3 && t[i + 1] === 'viertel' && isNum(t[i + 2]) && hour12(t[i + 2] as number)) {
      return { hour: prev(t[i + 2] as number), minute: 45 };
    }
    return undefined;
  },
  // "viertel vier" → 3:15 (regional)
  (t, i) => {
    const h = t[i + 1];
    if (t[i] === 'viertel' && isNum(h) && hour12(h)) {
      return { hour: prev(h), minute: 15 };
    }
    return undefined;
  },
  // "fünfzehn Uhr dreißig", "15 Uhr 30", "drei Uhr"
  (t, i) => {
    const [h, uhr, m] = [t[i], t[i + 1], t[i + 2]];
    if (isNum(h) && uhr === 'uhr') {
      return { hour: h, minute: isNum(m) ? m : 0 };
    }
    return undefined;
  },
  // "zehn nach drei" → 3:10 / "zehn vor vier" → 3:50
  (t, i) => {
    const [m, dir, h] = [t[i], t[i + 1], t[i + 2]];
    if (
      isNum(m) &&
      m >= 1 &&
      m <= 29 &&
      (dir === 'nach' || dir === 'vor') &&
      isNum(h) &&
      hour12(h)
    ) {
      return dir === 'nach' ? { hour: h, minute: m } : { hour: prev(h), minute: 60 - m };
    }
    return undefined;
  },
];

function tokenize(text: string): Token[] {
  const normalized = normalizeGerman(text)
    // "15.30" / "15:30" → "15 : 30"; leave dates like "21.11." alone (no 2-digit tail + word)
    .replace(/(\d{1,2})\s*[:.]\s*(\d{2})(?!\d|\.)/g, '$1 : $2')
    .replace(/[^a-z0-9:]+/g, ' ');
  return normalized
    .split(' ')
    .filter((w) => w.length > 0 && w !== 'minuten' && w !== 'minute')
    .map((w) => parseNumberToken(w) ?? w);
}

function resolve(raw: RawTime, period: DayPeriod | undefined): ParsedTime | undefined {
  const { minute } = raw;
  let { hour } = raw;
  if (hour > 23 || minute < 0 || minute > 59) return undefined;
  if (!hour12(hour)) return { hour, minute, ambiguous: false };

  if (period === 'am') return { hour: hour === 12 ? 0 : hour, minute, ambiguous: false };
  if (period === 'pm') return { hour: hour === 12 ? 12 : hour + 12, minute, ambiguous: false };
  if (period === 'noon') return { hour: hour <= 3 ? hour + 12 : hour, minute, ambiguous: false };

  // No day-period word. Practices open roughly 7–19, so 1–6 means afternoon.
  if (hour <= 6) hour += 12;
  return { hour, minute, ambiguous: true };
}

/**
 * Extracts the first clock time from German speech (STT output), e.g.
 * "Wir hätten Donnerstag um Viertel vor vier was frei" → 15:45 (ambiguous).
 * Returns `undefined` if no time is found.
 */
export function parseGermanTime(text: string): ParsedTime | undefined {
  const normalized = normalizeGerman(text);
  const period = DAY_PERIODS.find(([re]) => re.test(normalized))?.[1];
  const tokens = tokenize(text);
  const matchAt = (i: number): RawTime | undefined => {
    for (const pattern of PATTERNS) {
      const raw = pattern(tokens, i);
      if (raw) return raw;
    }
    return undefined;
  };
  for (let i = 0; i < tokens.length; i++) {
    const raw = matchAt(i);
    if (raw) return resolve(raw, period);
    // Bare "um drei" → 3:00, unless a fuller form follows ("um fünfzehn Uhr dreißig").
    const next = tokens[i + 1];
    if (tokens[i] === 'um' && isNum(next) && !matchAt(i + 1)) {
      return resolve({ hour: next, minute: 0 }, period);
    }
  }
  return undefined;
}

/** All plausible 24-hour readings of a parsed time, likeliest first. */
export function readings(parsed: ParsedTime): ClockTime[] {
  if (!parsed.ambiguous) return [{ hour: parsed.hour, minute: parsed.minute }];
  const other = (parsed.hour + 12) % 24;
  return [
    { hour: parsed.hour, minute: parsed.minute },
    { hour: other, minute: parsed.minute },
  ];
}
