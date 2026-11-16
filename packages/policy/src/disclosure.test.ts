import type { TranscriptTurn } from '@termin/domain';
import { describe, expect, it } from 'vitest';
import { disclosureSentence, isDisclosureFirst } from './disclosure.js';

const name = { given: 'Alex', family: 'Schmidt' };
const at = '2026-11-16T14:00:00+01:00';
const turn = (speaker: TranscriptTurn['speaker'], text: string): TranscriptTurn => ({
  speaker,
  text,
  at,
});

describe('disclosureSentence', () => {
  it('discloses AI and names the principal', () => {
    const s = disclosureSentence(name);
    expect(s).toBe(
      'Guten Tag, hier spricht ein KI-Assistent, also eine künstliche Intelligenz, im Auftrag von Alex Schmidt.',
    );
    expect(s).toMatch(/KI-Assistent/);
    expect(s).toContain('Alex Schmidt');
  });
});

describe('isDisclosureFirst', () => {
  const disclosure = disclosureSentence(name);

  it('passes when the first agent turn opens with the disclosure', () => {
    expect(
      isDisclosureFirst(
        [
          turn('practice', 'Praxis Dr. Beispiel, guten Tag?'),
          turn('agent', `${disclosure} Ich rufe an, um …`),
        ],
        name,
      ),
    ).toBe(true);
  });

  it('fails when the agent says anything else first, paraphrases, or never speaks', () => {
    expect(isDisclosureFirst([turn('agent', 'Hallo!'), turn('agent', disclosure)], name)).toBe(
      false,
    );
    expect(
      isDisclosureFirst(
        [turn('agent', 'Hallo, ich bin eine KI im Auftrag von Alex Schmidt.')],
        name,
      ),
    ).toBe(false);
    expect(isDisclosureFirst([turn('practice', 'Hallo?')], name)).toBe(false);
    expect(
      isDisclosureFirst([turn('agent', disclosureSentence({ given: 'Sam', family: 'Lee' }))], name),
    ).toBe(false);
  });
});
