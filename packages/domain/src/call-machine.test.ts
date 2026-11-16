import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CALL_PHASES, callMachine, liveCallPhaseSchema, type CallPhase } from './call-machine.js';
import { reachable } from './testing.js';

const ALLOWED = new Set([
  'dialing→disclosure',
  'dialing→voicemail',
  'dialing→dropped',
  'disclosure→negotiating',
  'disclosure→closing',
  'disclosure→voicemail',
  'disclosure→dropped',
  'negotiating→confirming',
  'negotiating→closing',
  'negotiating→dropped',
  'confirming→negotiating',
  'confirming→closing',
  'confirming→dropped',
  'closing→completed',
  'closing→callback_requested',
  'closing→refused',
]);

describe('callMachine', () => {
  it('has the expected initial and terminal phases', () => {
    expect(callMachine.initial).toBe('dialing');
    expect([...callMachine.terminalStates].sort()).toEqual(
      ['callback_requested', 'completed', 'dropped', 'refused', 'voicemail'].sort(),
    );
  });

  it('live phases are exactly the non-terminal phases', () => {
    expect([...liveCallPhaseSchema.options].sort()).toEqual(
      CALL_PHASES.filter((p) => !callMachine.isTerminal(p)).sort(),
    );
  });

  it.each(CALL_PHASES.flatMap((from) => CALL_PHASES.map((to) => [from, to] as const)))(
    '%s → %s matches the spec',
    (from, to) => {
      expect(callMachine.canTransition(from, to)).toBe(ALLOWED.has(`${from}→${to}`));
    },
  );

  it('the disclosure phase cannot be skipped to reach negotiation', () => {
    expect(callMachine.targets('dialing')).not.toContain('negotiating');
    expect(callMachine.targets('dialing')).not.toContain('closing');
  });

  it('every phase is reachable, and every live phase can still reach an end', () => {
    expect(reachable(callMachine, 'dialing')).toEqual(new Set(CALL_PHASES));
    for (const phase of CALL_PHASES) {
      const ends = [...reachable(callMachine, phase)].filter((p) => callMachine.isTerminal(p));
      expect(ends.length, phase).toBeGreaterThan(0);
    }
  });

  it('random walks never leave the table and stay terminal once ended', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { maxLength: 50 }), (choices) => {
        let phase: CallPhase = callMachine.initial;
        for (const c of choices) {
          const targets = callMachine.targets(phase);
          if (targets.length === 0) break;
          phase = callMachine.transition(phase, targets[c % targets.length]!);
          expect(CALL_PHASES).toContain(phase);
        }
      }),
    );
  });
});
