import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { REQUEST_STATUSES, requestMachine, type RequestStatus } from './request-machine.js';
import { reachable } from './testing.js';

/** The specification, written independently of the implementation's table. */
const ALLOWED = new Set([
  'draft→queued',
  'queued→calling',
  'queued→failed',
  'calling→booked',
  'calling→no_slot',
  'calling→callback',
  'calling→failed',
]);

describe('requestMachine', () => {
  it('starts in draft and has exactly the four outcome states as terminals', () => {
    expect(requestMachine.initial).toBe('draft');
    expect([...requestMachine.terminalStates].sort()).toEqual(
      ['booked', 'callback', 'failed', 'no_slot'].sort(),
    );
    expect(requestMachine.states).toEqual(REQUEST_STATUSES);
  });

  it.each(REQUEST_STATUSES.flatMap((from) => REQUEST_STATUSES.map((to) => [from, to] as const)))(
    '%s → %s matches the spec',
    (from, to) => {
      const allowed = ALLOWED.has(`${from}→${to}`);
      expect(requestMachine.canTransition(from, to)).toBe(allowed);
      if (allowed) expect(requestMachine.transition(from, to)).toBe(to);
      else expect(() => requestMachine.transition(from, to)).toThrow(/not allowed/);
    },
  );

  it('every state is reachable from draft', () => {
    expect(reachable(requestMachine, 'draft')).toEqual(new Set(REQUEST_STATUSES));
  });

  it('every random walk terminates within |states| steps (no cycles)', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 10, maxLength: 10 }), (choices) => {
        let state: RequestStatus = requestMachine.initial;
        for (const c of choices) {
          const targets = requestMachine.targets(state);
          if (targets.length === 0) break;
          state = requestMachine.transition(state, targets[c % targets.length]!);
        }
        expect(requestMachine.isTerminal(state)).toBe(true);
      }),
    );
  });
});
