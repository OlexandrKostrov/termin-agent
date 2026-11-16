import { phoneDigit } from './numbers.js';

export type SpellingAlphabet = 'din5009' | 'traditional';

/**
 * DIN 5009:2022 (city names) and the older "Anton, Berta, Cäsar" alphabet,
 * which many receptionists still use. Keys are upper case.
 */
const ALPHABETS: Readonly<Record<SpellingAlphabet, Readonly<Record<string, string>>>> = {
  din5009: {
    A: 'Aachen',
    Ä: 'Umlaut Aachen',
    B: 'Berlin',
    C: 'Chemnitz',
    D: 'Düsseldorf',
    E: 'Essen',
    F: 'Frankfurt',
    G: 'Goslar',
    H: 'Hamburg',
    I: 'Ingelheim',
    J: 'Jena',
    K: 'Köln',
    L: 'Leipzig',
    M: 'München',
    N: 'Nürnberg',
    O: 'Offenbach',
    Ö: 'Umlaut Offenbach',
    P: 'Potsdam',
    Q: 'Quickborn',
    R: 'Rostock',
    S: 'Salzwedel',
    ẞ: 'Eszett',
    T: 'Tübingen',
    U: 'Unna',
    Ü: 'Umlaut Unna',
    V: 'Völklingen',
    W: 'Wuppertal',
    X: 'Xanten',
    Y: 'Ypsilon',
    Z: 'Zwickau',
  },
  traditional: {
    A: 'Anton',
    Ä: 'Ärger',
    B: 'Berta',
    C: 'Cäsar',
    D: 'Dora',
    E: 'Emil',
    F: 'Friedrich',
    G: 'Gustav',
    H: 'Heinrich',
    I: 'Ida',
    J: 'Julius',
    K: 'Kaufmann',
    L: 'Ludwig',
    M: 'Martha',
    N: 'Nordpol',
    O: 'Otto',
    Ö: 'Ökonom',
    P: 'Paula',
    Q: 'Quelle',
    R: 'Richard',
    S: 'Samuel',
    ẞ: 'Eszett',
    T: 'Theodor',
    U: 'Ulrich',
    Ü: 'Übermut',
    V: 'Viktor',
    W: 'Wilhelm',
    X: 'Xanthippe',
    Y: 'Ypsilon',
    Z: 'Zacharias',
  },
};

const SEPARATORS: Readonly<Record<string, string>> = {
  '-': 'Bindestrich',
  ' ': 'Leerzeichen',
  "'": 'Apostroph',
  '.': 'Punkt',
  '/': 'Schrägstrich',
};

export type SpellingUnit =
  | {
      readonly kind: 'letter';
      readonly letter: string;
      readonly codeword: string;
      readonly count: number;
      /** The source letter carried a diacritic other than an umlaut (é, ç, …). */
      readonly accented: boolean;
    }
  | {
      readonly kind: 'digit';
      readonly digit: number;
      readonly spoken: string;
      readonly count: number;
    }
  | { readonly kind: 'separator'; readonly char: string; readonly spoken: string }
  | { readonly kind: 'unknown'; readonly char: string };

/** Upper-cases while keeping ß distinct (JS maps "ß" → "SS"). */
function upper(ch: string): string {
  return ch === 'ß' ? 'ẞ' : ch.toUpperCase();
}

function stripDiacritics(ch: string): string {
  return ch.normalize('NFD').replace(/\p{M}/gu, '');
}

function unitFor(ch: string, alphabet: SpellingAlphabet): SpellingUnit {
  const table = ALPHABETS[alphabet];
  if (/^\d$/.test(ch)) {
    const digit = Number(ch);
    return { kind: 'digit', digit, spoken: phoneDigit(digit), count: 1 };
  }
  const sep = SEPARATORS[ch];
  if (sep !== undefined) return { kind: 'separator', char: ch, spoken: sep };

  const u = upper(ch);
  const direct = table[u];
  if (direct !== undefined)
    return { kind: 'letter', letter: u, codeword: direct, count: 1, accented: false };
  const base = stripDiacritics(u);
  const viaBase = table[base];
  if (viaBase !== undefined) {
    return { kind: 'letter', letter: base, codeword: viaBase, count: 1, accented: true };
  }
  return { kind: 'unknown', char: ch };
}

function sameSymbol(a: SpellingUnit, b: SpellingUnit): boolean {
  if (a.kind === 'letter' && b.kind === 'letter') {
    return a.letter === b.letter && a.accented === b.accented;
  }
  return a.kind === 'digit' && b.kind === 'digit' && a.digit === b.digit;
}

/** Spells a word into units, collapsing doubled letters/digits ("zweimal L"). */
export function spell(word: string, alphabet: SpellingAlphabet = 'din5009'): SpellingUnit[] {
  const units: SpellingUnit[] = [];
  for (const ch of word.normalize('NFC')) {
    const unit = unitFor(ch, alphabet);
    const last = units.at(-1);
    if (last && sameSymbol(last, unit) && (last.kind === 'letter' || last.kind === 'digit')) {
      units[units.length - 1] = { ...last, count: last.count + 1 };
    } else {
      units.push(unit);
    }
  }
  return units;
}

const MULTIPLIERS: Readonly<Record<number, string>> = { 2: 'zweimal', 3: 'dreimal' };

function times(count: number): string {
  return count === 1 ? '' : `${MULTIPLIERS[count] ?? `${count}-mal`} `;
}

function speakUnit(unit: SpellingUnit): string {
  switch (unit.kind) {
    case 'letter': {
      const accent = unit.accented ? ' mit Akzent' : '';
      return `${times(unit.count)}${unit.letter} wie ${unit.codeword}${accent}`;
    }
    case 'digit':
      return `${times(unit.count)}${unit.spoken}`;
    case 'separator':
      return unit.spoken;
    case 'unknown':
      return unit.char;
  }
}

/**
 * Spoken spelling for the agent:
 * "Müller" → "M wie München, Ü wie Umlaut Unna, zweimal L wie Leipzig, E wie Essen, R wie Rostock"
 */
export function spellForSpeech(word: string, alphabet: SpellingAlphabet = 'din5009'): string {
  return spell(word, alphabet).map(speakUnit).join(', ');
}
