import type { PatientProfile, Visit } from '@termin/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SPEAKABLE_FIELDS, guardField, type FieldSource } from './fields.js';

const minimal: FieldSource = {
  profile: { name: { given: 'Alex', family: 'Schmidt' } },
  visit: { kind: 'general', shareDetail: false, newPatient: false },
};

const full: FieldSource = {
  profile: {
    name: { given: 'Alex', family: 'Schmidt' },
    birthDate: '1990-05-17',
    insurance: { type: 'privat', provider: 'Allianz' },
    phone: '+4915112345678',
  },
  visit: { kind: 'acute', detail: 'sore throat', shareDetail: true, newPatient: true },
};

describe('guardField', () => {
  it('returns values verbatim from the user input', () => {
    expect(guardField('fullName', full)).toEqual({
      ok: true,
      field: 'fullName',
      value: 'Alex Schmidt',
    });
    expect(guardField('birthDate', full)).toMatchObject({ ok: true, value: '1990-05-17' });
    expect(guardField('insuranceType', full)).toMatchObject({ ok: true, value: 'privat' });
    expect(guardField('visitDetail', full)).toMatchObject({ ok: true, value: 'sore throat' });
  });

  it('refuses missing data with a scripted German fallback', () => {
    const r = guardField('birthDate', minimal);
    expect(r).toEqual({
      ok: false,
      field: 'birthDate',
      reason: 'not_provided',
      fallbackDe:
        'Diese Angabe liegt mir leider nicht vor. Alex Schmidt kann sie gerne nachreichen.',
    });
  });

  it('withholds the visit detail unless the user opted in', () => {
    const optedOut: FieldSource = { ...full, visit: { ...full.visit, shareDetail: false } };
    expect(guardField('visitDetail', optedOut)).toMatchObject({ ok: false, reason: 'not_shared' });
    expect(guardField('visitKind', optedOut)).toMatchObject({ ok: true, value: 'acute' });
  });
});

// ── Property: the guard never invents data ──────────────────────────────────

const namePart = fc.stringMatching(/^[A-ZÄÖÜ][a-zäöüß]{1,12}$/);
const profileArb: fc.Arbitrary<PatientProfile> = fc.record(
  {
    name: fc.record({ given: namePart, family: namePart }),
    birthDate: fc
      .date({ min: new Date('1920-01-01'), max: new Date('2025-12-31'), noInvalidDate: true })
      .map((d) => d.toISOString().slice(0, 10)),
    insurance: fc.record(
      { type: fc.constantFrom('gesetzlich' as const, 'privat' as const), provider: namePart },
      { requiredKeys: ['type'] },
    ),
    phone: fc.stringMatching(/^\+49[1-9]\d{8,11}$/),
  },
  { requiredKeys: ['name'] },
);
const visitArb: fc.Arbitrary<Visit> = fc.record(
  {
    kind: fc.constantFrom(
      'general',
      'checkup',
      'acute',
      'follow_up',
      'vaccination',
      'prescription',
    ),
    detail: fc.string({ minLength: 1, maxLength: 40 }),
    shareDetail: fc.boolean(),
    newPatient: fc.boolean(),
  },
  { requiredKeys: ['kind', 'shareDetail', 'newPatient'] },
);

describe('guardField: properties', () => {
  it('every value it releases is present verbatim in the input; absent data is never released', () => {
    fc.assert(
      fc.property(
        profileArb,
        visitArb,
        fc.constantFrom(...SPEAKABLE_FIELDS),
        (profile, visit, field) => {
          const source = { profile, visit };
          const r = guardField(field, source);
          const input = JSON.stringify(source);
          if (r.ok) {
            for (const part of r.value.split(' '))
              expect(input).toContain(JSON.stringify(part).slice(1, -1));
          } else {
            expect(r.fallbackDe).toContain(`${profile.name.given} ${profile.name.family}`);
          }
          const present: Record<string, boolean> = {
            birthDate: profile.birthDate !== undefined,
            insuranceType: profile.insurance !== undefined,
            insuranceProvider: profile.insurance?.provider !== undefined,
            callbackPhone: profile.phone !== undefined,
            visitDetail: visit.detail !== undefined && visit.shareDetail,
          };
          expect(r.ok).toBe(present[field] ?? true);
        },
      ),
    );
  });
});
