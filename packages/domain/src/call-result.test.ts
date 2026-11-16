import { describe, expect, it } from 'vitest';
import { callMachine } from './call-machine.js';
import {
  callResultSchema,
  requestStatusFor,
  terminalPhaseFor,
  type CallOutcome,
} from './call-result.js';
import { requestMachine } from './request-machine.js';

const OUTCOMES: readonly CallOutcome[] = [
  'booked',
  'no_slot',
  'callback_requested',
  'voicemail',
  'refused',
  'dropped',
];

const base = {
  callId: '6f1c2f3e-1d2b-4c5a-9e8f-0a1b2c3d4e5f',
  startedAt: '2026-11-16T14:00:00+01:00',
  endedAt: '2026-11-16T14:03:10+01:00',
  transcript: [{ speaker: 'agent', text: 'Guten Tag …', at: '2026-11-16T14:00:05+01:00' }],
};

describe('outcome mappings', () => {
  it.each(OUTCOMES)('%s ends the call in a terminal phase', (outcome) => {
    expect(callMachine.isTerminal(terminalPhaseFor(outcome))).toBe(true);
  });

  it.each(OUTCOMES)('%s maps to a terminal request status reachable from calling', (outcome) => {
    const status = requestStatusFor(outcome);
    expect(requestMachine.isTerminal(status)).toBe(true);
    expect(requestMachine.canTransition('calling', status)).toBe(true);
  });

  it('maps the documented cases', () => {
    expect(OUTCOMES.map(requestStatusFor)).toEqual([
      'booked',
      'no_slot',
      'callback',
      'callback',
      'failed',
      'failed',
    ]);
  });

  it('every request terminal reachable from calling is produced by some outcome', () => {
    const produced = new Set(OUTCOMES.map(requestStatusFor));
    expect(produced).toEqual(new Set(requestMachine.targets('calling')));
  });
});

describe('callResultSchema', () => {
  it('accepts a booked result', () => {
    const r = callResultSchema.parse({
      ...base,
      outcome: 'booked',
      slot: { start: '2026-11-19T15:30:00+01:00', durationMinutes: 15 },
    });
    expect(r.outcome).toBe('booked');
  });

  it('rejects a booked result without a slot, and unknown outcomes', () => {
    expect(callResultSchema.safeParse({ ...base, outcome: 'booked' }).success).toBe(false);
    expect(callResultSchema.safeParse({ ...base, outcome: 'maybe' }).success).toBe(false);
  });

  it('dropped must name a live phase', () => {
    expect(
      callResultSchema.safeParse({ ...base, outcome: 'dropped', duringPhase: 'negotiating' })
        .success,
    ).toBe(true);
    expect(
      callResultSchema.safeParse({ ...base, outcome: 'dropped', duringPhase: 'completed' }).success,
    ).toBe(false);
  });

  it('declined offers must carry at least one reason', () => {
    const offer = { slot: { start: '2026-11-18T16:00:00+01:00' }, reasons: [] };
    expect(
      callResultSchema.safeParse({ ...base, outcome: 'no_slot', declinedOffers: [offer] }).success,
    ).toBe(false);
  });
});
