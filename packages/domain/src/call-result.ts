import { z } from 'zod';
import type { CallPhase } from './call-machine.js';
import { liveCallPhaseSchema } from './call-machine.js';
import type { RequestStatus } from './request-machine.js';
import { isoInstantSchema, slotSchema, transcriptTurnSchema } from './schemas.js';

const base = {
  callId: z.uuid(),
  startedAt: isoInstantSchema,
  endedAt: isoInstantSchema,
  transcript: z.array(transcriptTurnSchema),
};

/** A slot the practice offered that the policy guard declined, with reasons. */
export const declinedOfferSchema = z.object({
  slot: slotSchema,
  reasons: z.array(z.string()).min(1),
});

/** The structured result of one call. Exactly one variant per outcome. */
export const callResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    ...base,
    outcome: z.literal('booked'),
    slot: slotSchema,
    /** Anything the practice asked the patient to bring or know ("Versichertenkarte mitbringen"). */
    practiceNote: z.string().optional(),
  }),
  z.object({
    ...base,
    outcome: z.literal('no_slot'),
    declinedOffers: z.array(declinedOfferSchema),
  }),
  z.object({
    ...base,
    outcome: z.literal('callback_requested'),
    callbackAfter: isoInstantSchema.optional(),
    note: z.string().optional(),
  }),
  z.object({
    ...base,
    outcome: z.literal('voicemail'),
    retryAfter: isoInstantSchema.optional(),
  }),
  z.object({
    ...base,
    outcome: z.literal('refused'),
    reason: z.string().optional(),
  }),
  z.object({
    ...base,
    outcome: z.literal('dropped'),
    /** The phase the call was in when the line dropped. */
    duringPhase: liveCallPhaseSchema,
  }),
]);
export type CallResult = z.infer<typeof callResultSchema>;
export type CallOutcome = CallResult['outcome'];

/** The terminal call phase each outcome must end in. */
export function terminalPhaseFor(outcome: CallOutcome): CallPhase {
  switch (outcome) {
    case 'booked':
    case 'no_slot':
      return 'completed';
    case 'callback_requested':
    case 'voicemail':
    case 'refused':
    case 'dropped':
      return outcome;
  }
}

/**
 * Maps a call outcome onto the request's terminal status.
 * Voicemail counts as `callback`: nobody was reached, so try again later.
 * Refusals and dropped calls are `failed`. The result keeps the detail.
 */
export function requestStatusFor(outcome: CallOutcome): RequestStatus {
  switch (outcome) {
    case 'booked':
      return 'booked';
    case 'no_slot':
      return 'no_slot';
    case 'callback_requested':
    case 'voicemail':
      return 'callback';
    case 'refused':
    case 'dropped':
      return 'failed';
  }
}
