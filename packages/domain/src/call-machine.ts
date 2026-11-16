import { z } from 'zod';
import { defineMachine } from './machine.js';

export const CALL_PHASES = [
  'dialing',
  'disclosure',
  'negotiating',
  'confirming',
  'closing',
  'completed',
  'voicemail',
  'callback_requested',
  'refused',
  'dropped',
] as const;
export const callPhaseSchema = z.enum(CALL_PHASES);
export type CallPhase = z.infer<typeof callPhaseSchema>;

/**
 * Phases of one outbound call. The LLM chooses words *within* a phase. Phase
 * changes are explicit and validated against this table.
 *
 *   dialing ─► disclosure ─► negotiating ⇄ confirming
 *      │           │              │            │
 *      │           └──────────────┴────────────┴─► closing ─► completed
 *      │                                                   ├─► callback_requested
 *      │                                                   └─► refused
 *      └─► voicemail (also from disclosure: late detection)
 *   any live phase ─► dropped (except closing: the business is already settled,
 *                    so a hang-up during goodbyes still ends in closing's outcome)
 *
 * `disclosure` always speaks the fixed AI-disclosure sentence first.
 */
export const callMachine = defineMachine<CallPhase>('call', 'dialing', {
  dialing: ['disclosure', 'voicemail', 'dropped'],
  disclosure: ['negotiating', 'closing', 'voicemail', 'dropped'],
  negotiating: ['confirming', 'closing', 'dropped'],
  confirming: ['negotiating', 'closing', 'dropped'],
  closing: ['completed', 'callback_requested', 'refused'],
  completed: [],
  voicemail: [],
  callback_requested: [],
  refused: [],
  dropped: [],
});

/** Non-terminal phases (where a call can be when the line drops). */
export const liveCallPhaseSchema = callPhaseSchema.extract([
  'dialing',
  'disclosure',
  'negotiating',
  'confirming',
  'closing',
]);
export type LiveCallPhase = z.infer<typeof liveCallPhaseSchema>;
