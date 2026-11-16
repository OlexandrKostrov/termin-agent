import type { PatientProfile, Visit } from '@termin/domain';

/** Personal data the receptionist may ask for. */
export const SPEAKABLE_FIELDS = [
  'givenName',
  'familyName',
  'fullName',
  'birthDate',
  'insuranceType',
  'insuranceProvider',
  'callbackPhone',
  'visitKind',
  'visitDetail',
] as const;
export type SpeakableField = (typeof SPEAKABLE_FIELDS)[number];

export type FieldGuardResult =
  | { readonly ok: true; readonly field: SpeakableField; readonly value: string }
  | {
      readonly ok: false;
      readonly field: SpeakableField;
      readonly reason: 'not_provided' | 'not_shared';
      /** What the agent says instead. Fixed German text, never generated. */
      readonly fallbackDe: string;
    };

export interface FieldSource {
  readonly profile: PatientProfile;
  readonly visit: Visit;
}

/**
 * Raw value of a field, straight from user-provided data, or `undefined`.
 * This function is the only place personal data enters the conversation.
 */
function sourceValue(field: SpeakableField, { profile, visit }: FieldSource): string | undefined {
  switch (field) {
    case 'givenName':
      return profile.name.given;
    case 'familyName':
      return profile.name.family;
    case 'fullName':
      return `${profile.name.given} ${profile.name.family}`;
    case 'birthDate':
      return profile.birthDate;
    case 'insuranceType':
      return profile.insurance?.type;
    case 'insuranceProvider':
      return profile.insurance?.provider;
    case 'callbackPhone':
      return profile.phone;
    case 'visitKind':
      return visit.kind;
    case 'visitDetail':
      return visit.detail;
  }
}

/**
 * Gate for every piece of personal data the agent speaks. Values come only
 * from the user's input. A missing value yields a scripted fallback, so the
 * LLM has nothing to fill in.
 */
export function guardField(field: SpeakableField, source: FieldSource): FieldGuardResult {
  const fullName = `${source.profile.name.given} ${source.profile.name.family}`;
  if (field === 'visitDetail' && !source.visit.shareDetail) {
    return {
      ok: false,
      field,
      reason: 'not_shared',
      fallbackDe: `Details zum Anliegen möchte ${fullName} lieber direkt in der Praxis besprechen.`,
    };
  }
  const value = sourceValue(field, source);
  if (value === undefined) {
    return {
      ok: false,
      field,
      reason: 'not_provided',
      fallbackDe: `Diese Angabe liegt mir leider nicht vor. ${fullName} kann sie gerne nachreichen.`,
    };
  }
  return { ok: true, field, value };
}
