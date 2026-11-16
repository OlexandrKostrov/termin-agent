import { describe, expect, it } from 'vitest';
import { spell, spellForSpeech } from './spelling.js';

describe('spellForSpeech', () => {
  it('spells with DIN 5009:2022 and collapses double letters', () => {
    expect(spellForSpeech('Müller')).toBe(
      'M wie München, Ü wie Umlaut Unna, zweimal L wie Leipzig, E wie Essen, R wie Rostock',
    );
  });

  it('supports the traditional alphabet', () => {
    expect(spellForSpeech('Otto', 'traditional')).toBe(
      'O wie Otto, zweimal T wie Theodor, O wie Otto',
    );
  });

  it('handles ß, hyphens, spaces and accents', () => {
    expect(spellForSpeech('Groß-Weber')).toBe(
      'G wie Goslar, R wie Rostock, O wie Offenbach, ẞ wie Eszett, Bindestrich, ' +
        'W wie Wuppertal, E wie Essen, B wie Berlin, E wie Essen, R wie Rostock',
    );
    expect(spellForSpeech('René')).toBe(
      'R wie Rostock, E wie Essen, N wie Nürnberg, E wie Essen mit Akzent',
    );
    expect(spellForSpeech('de la')).toBe(
      'D wie Düsseldorf, E wie Essen, Leerzeichen, L wie Leipzig, A wie Aachen',
    );
  });

  it('dictates digits with "zwo" and collapses repeats', () => {
    expect(spellForSpeech('A122')).toBe('A wie Aachen, eins, zweimal zwo');
  });
});

describe('spell', () => {
  it('does not merge an accented letter with its plain twin', () => {
    expect(spell('eé').map((u) => u.kind === 'letter' && u.count)).toEqual([1, 1]);
  });

  it('keeps unknown characters verbatim', () => {
    expect(spell('Ω')).toEqual([{ kind: 'unknown', char: 'Ω' }]);
  });

  it('decomposed input (NFD) is normalised first', () => {
    expect(spellForSpeech('Müller')).toBe(spellForSpeech('Müller'));
  });
});
