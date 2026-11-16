import { z } from 'zod';
import { defineMachine } from './machine.js';

export const REQUEST_STATUSES = [
  'draft',
  'queued',
  'calling',
  'booked',
  'no_slot',
  'callback',
  'failed',
] as const;
export const requestStatusSchema = z.enum(REQUEST_STATUSES);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

/**
 * Lifecycle of a booking request (one request = one call attempt in the MVP).
 *
 *   draft ─► queued ─► calling ─► booked | no_slot | callback | failed
 *              └──────────────────────────────────────────────► failed
 *
 * `draft`: parsed, awaiting the user's confirmation of the constraints.
 * `queued → failed`: pre-flight refusal (e.g. number not on the allow-list).
 * `callback`: the call needs another attempt later (practice asked, or voicemail).
 * Retries create a new request linked to this one, so terminal states stay terminal.
 */
export const requestMachine = defineMachine<RequestStatus>('request', 'draft', {
  draft: ['queued'],
  queued: ['calling', 'failed'],
  calling: ['booked', 'no_slot', 'callback', 'failed'],
  booked: [],
  no_slot: [],
  callback: [],
  failed: [],
});
