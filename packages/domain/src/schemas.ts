import { BUNDESLAENDER } from '@termin/time-de';
import { z } from 'zod';

// ── Primitives ─────────────────────────────────────────────────────────────

/** Calendar date, YYYY-MM-DD. */
export const isoDateSchema = z.iso.date();
/** Instant with an explicit offset (no floating local times). */
export const isoInstantSchema = z.iso.datetime({ offset: true });
/** 24-hour wall-clock time in Europe/Berlin, HH:mm. */
export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm (24h)');
/** E.164 phone number. */
export const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Expected E.164, e.g. +4930123456');
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
export const bundeslandSchema = z.enum(BUNDESLAENDER);

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

// ── Principal (the person we call for) ─────────────────────────────────────

export const insuranceTypeSchema = z.enum(['gesetzlich', 'privat']);
export type InsuranceType = z.infer<typeof insuranceTypeSchema>;

/**
 * Personal data the agent may speak. Everything except the name is optional:
 * a missing field is never filled in. The agent says it doesn't know.
 */
export const patientProfileSchema = z.object({
  name: z.object({ given: nonEmpty(100), family: nonEmpty(100) }),
  birthDate: isoDateSchema.optional(),
  insurance: z
    .object({
      type: insuranceTypeSchema,
      /** Krankenkasse / insurer name, e.g. "Techniker Krankenkasse". */
      provider: nonEmpty(100).optional(),
    })
    .optional(),
  /** Callback number the practice may use. */
  phone: e164Schema.optional(),
});
export type PatientProfile = z.infer<typeof patientProfileSchema>;

// ── Practice & visit ───────────────────────────────────────────────────────

export const practiceSchema = z.object({
  name: nonEmpty(200),
  phone: e164Schema,
  /** Used for public holidays; unknown → nationwide holidays only. */
  state: bundeslandSchema.optional(),
});
export type Practice = z.infer<typeof practiceSchema>;

export const visitSchema = z.object({
  kind: z.enum(['general', 'checkup', 'acute', 'follow_up', 'vaccination', 'prescription']),
  /** Free-text reason. Only spoken if `shareDetail` (GDPR Art. 9 minimisation). */
  detail: nonEmpty(300).optional(),
  shareDetail: z.boolean().default(false),
  /** Many practices treat new patients differently ("Neupatient"). */
  newPatient: z.boolean(),
});
export type Visit = z.infer<typeof visitSchema>;

// ── Constraints ────────────────────────────────────────────────────────────

/**
 * The user's hard constraints, already resolved to absolute dates. All
 * wall-clock values are Europe/Berlin. Bounds are inclusive.
 */
export const constraintsSchema = z
  .object({
    dateRange: z.object({ from: isoDateSchema, to: isoDateSchema }),
    /** Earliest acceptable start time ("after 15:00" → "15:00"). */
    earliestStart: clockTimeSchema.optional(),
    /** Latest acceptable start time. */
    latestStart: clockTimeSchema.optional(),
    excludedWeekdays: z.array(isoWeekdaySchema).max(7).default([]),
    excludedDates: z.array(isoDateSchema).max(366).default([]),
  })
  .refine((c) => c.dateRange.from <= c.dateRange.to, {
    message: 'dateRange.from must not be after dateRange.to',
    path: ['dateRange'],
  })
  .refine(
    (c) =>
      c.earliestStart === undefined ||
      c.latestStart === undefined ||
      c.earliestStart <= c.latestStart,
    { message: 'earliestStart must not be after latestStart', path: ['earliestStart'] },
  );
export type Constraints = z.infer<typeof constraintsSchema>;

// ── Request ────────────────────────────────────────────────────────────────

export const bookingRequestSchema = z.object({
  id: z.uuid(),
  /** The user's original wording, kept for audit and evals. */
  originalText: nonEmpty(1000),
  principal: patientProfileSchema,
  practice: practiceSchema,
  visit: visitSchema,
  constraints: constraintsSchema,
  createdAt: isoInstantSchema,
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

// ── Call artefacts ─────────────────────────────────────────────────────────

export const slotSchema = z.object({
  start: isoInstantSchema,
  durationMinutes: z.number().int().positive().max(480).optional(),
});
export type Slot = z.infer<typeof slotSchema>;

export const transcriptTurnSchema = z.object({
  speaker: z.enum(['agent', 'practice', 'system']),
  text: z.string(),
  at: isoInstantSchema,
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
