/**
 * German number words. Generation is the single source of truth; parsing
 * inverts the generated table, so speak → parse round-trips by construction.
 */

const UNITS = [
  'null',
  'eins',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
] as const;

const TENS = [
  '',
  '',
  'zwanzig',
  'dreißig',
  'vierzig',
  'fünfzig',
  'sechzig',
  'siebzig',
  'achtzig',
  'neunzig',
] as const;

function assertInt(n: number, min: number, max: number): void {
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new RangeError(`Expected an integer in [${min}, ${max}], got ${n}`);
  }
}

/** Prefix form of 1 used inside compounds ("einundzwanzig", "einhundert"). */
function prefix(n: number): string {
  return n === 1 ? 'ein' : cardinal(n);
}

/** Cardinal number in words, 0–9999. `cardinal(21)` → "einundzwanzig". */
export function cardinal(n: number): string {
  assertInt(n, 0, 9999);
  if (n < 20) return UNITS[n] as string;
  if (n < 100) {
    const unit = n % 10;
    const tens = TENS[Math.floor(n / 10)] as string;
    return unit === 0 ? tens : `${prefix(unit)}und${tens}`;
  }
  if (n < 1000) {
    const rest = n % 100;
    return `${prefix(Math.floor(n / 100))}hundert${rest === 0 ? '' : cardinal(rest)}`;
  }
  const rest = n % 1000;
  return `${prefix(Math.floor(n / 1000))}tausend${rest === 0 ? '' : cardinal(rest)}`;
}

/** Year as spoken: 1988 → "neunzehnhundertachtundachtzig", 2005 → "zweitausendfünf". */
export function year(n: number): string {
  assertInt(n, 1000, 9999);
  if (n >= 1100 && n < 2000) {
    const rest = n % 100;
    return `${cardinal(Math.floor(n / 100))}hundert${rest === 0 ? '' : cardinal(rest)}`;
  }
  return cardinal(n);
}

const IRREGULAR_ORDINAL_STEMS: Readonly<Record<number, string>> = {
  1: 'erst',
  3: 'dritt',
  7: 'siebt',
  8: 'acht',
};

export type OrdinalEnding = 'e' | 'en' | 'er';

/**
 * Ordinal number with an adjective ending, 1–99.
 * `ordinal(21)` → "einundzwanzigsten", `ordinal(3, 'er')` → "dritter".
 */
export function ordinal(n: number, ending: OrdinalEnding = 'en'): string {
  assertInt(n, 1, 99);
  const stem = n < 20 ? (IRREGULAR_ORDINAL_STEMS[n] ?? `${cardinal(n)}t`) : `${cardinal(n)}st`;
  return stem + ending;
}

/** Digits as dictated on the phone ("zwo" avoids zwei/drei confusion). */
const PHONE_DIGITS = [
  'null',
  'eins',
  'zwo',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
] as const;

export function phoneDigit(d: number): string {
  assertInt(d, 0, 9);
  return PHONE_DIGITS[d] as string;
}

/**
 * Normalises German text for matching: lower case, umlauts transliterated,
 * ß → ss. STT engines differ in how they emit these characters.
 */
export function normalizeGerman(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

const WORD_TO_NUMBER: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let n = 0; n <= 59; n++) map.set(normalizeGerman(cardinal(n)), n);
  map.set('ein', 1);
  map.set('eine', 1);
  map.set('zwo', 2);
  return map;
})();

/**
 * Parses a single German number word (0–59) or a run of digits.
 * Returns `undefined` for anything else.
 */
export function parseNumberToken(token: string): number | undefined {
  if (/^\d{1,4}$/.test(token)) return Number(token);
  return WORD_TO_NUMBER.get(normalizeGerman(token));
}
