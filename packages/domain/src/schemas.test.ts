import { describe, expect, it } from 'vitest';
import {
  bookingRequestSchema,
  constraintsSchema,
  e164Schema,
  patientProfileSchema,
  slotSchema,
} from './schemas.js';

describe('constraintsSchema', () => {
  it('applies defaults', () => {
    expect(
      constraintsSchema.parse({ dateRange: { from: '2026-11-23', to: '2026-11-29' } }),
    ).toEqual({
      dateRange: { from: '2026-11-23', to: '2026-11-29' },
      excludedWeekdays: [],
      excludedDates: [],
    });
  });

  it('rejects inverted ranges and inverted time windows', () => {
    expect(
      constraintsSchema.safeParse({ dateRange: { from: '2026-11-29', to: '2026-11-23' } }).success,
    ).toBe(false);
    expect(
      constraintsSchema.safeParse({
        dateRange: { from: '2026-11-23', to: '2026-11-29' },
        earliestStart: '16:00',
        latestStart: '15:00',
      }).success,
    ).toBe(false);
  });

  it('rejects malformed times, dates and weekdays', () => {
    const range = { from: '2026-11-23', to: '2026-11-29' };
    expect(constraintsSchema.safeParse({ dateRange: range, earliestStart: '9:00' }).success).toBe(
      false,
    );
    expect(constraintsSchema.safeParse({ dateRange: range, earliestStart: '24:00' }).success).toBe(
      false,
    );
    expect(constraintsSchema.safeParse({ dateRange: range, excludedWeekdays: [0] }).success).toBe(
      false,
    );
    expect(
      constraintsSchema.safeParse({ dateRange: { from: '2026-02-30', to: '2026-03-01' } }).success,
    ).toBe(false);
  });
});

describe('patientProfileSchema', () => {
  it('requires only the name', () => {
    expect(patientProfileSchema.parse({ name: { given: 'Max', family: 'Mustermann' } })).toEqual({
      name: { given: 'Max', family: 'Mustermann' },
    });
  });

  it('accepts real-world names and rejects markup', () => {
    for (const family of ["O'Brien", 'Müller-Lüdenscheidt', 'de la Cruz', 'Nguyễn', 'St. John']) {
      expect(patientProfileSchema.safeParse({ name: { given: 'A', family } }).success, family).toBe(
        true,
      );
    }
    for (const family of ['<speak>', 'Max{x}', '-Max', 'Robert"); DROP']) {
      expect(patientProfileSchema.safeParse({ name: { given: 'A', family } }).success, family).toBe(
        false,
      );
    }
  });

  it('rejects blank names and unknown insurance types', () => {
    expect(patientProfileSchema.safeParse({ name: { given: ' ', family: 'X' } }).success).toBe(
      false,
    );
    expect(
      patientProfileSchema.safeParse({
        name: { given: 'Max', family: 'Mustermann' },
        insurance: { type: 'public' },
      }).success,
    ).toBe(false);
  });
});

describe('primitives', () => {
  it('e164', () => {
    expect(e164Schema.safeParse('+4930123456').success).toBe(true);
    expect(e164Schema.safeParse('030123456').success).toBe(false);
    expect(e164Schema.safeParse('+49 30 123456').success).toBe(false);
  });

  it('slot start needs an offset', () => {
    expect(slotSchema.safeParse({ start: '2026-11-19T15:30:00+01:00' }).success).toBe(true);
    expect(slotSchema.safeParse({ start: '2026-11-19T15:30:00Z' }).success).toBe(true);
    expect(slotSchema.safeParse({ start: '2026-11-19T15:30:00' }).success).toBe(false);
  });
});

describe('bookingRequestSchema', () => {
  it('parses a full request and defaults shareDetail to false', () => {
    const r = bookingRequestSchema.parse({
      id: '0b8e7c2a-5f4d-4e3b-8a1c-9d2e3f4a5b6c',
      originalText: 'Book me a GP appointment next week, after 15:00, not Wednesday',
      principal: {
        name: { given: 'Max', family: 'Mustermann' },
        birthDate: '1988-03-14',
        insurance: { type: 'gesetzlich', provider: 'Techniker Krankenkasse' },
      },
      practice: { name: 'Hausarztpraxis Dr. Beispiel', phone: '+4930000000000', state: 'BE' },
      visit: { kind: 'general', detail: 'persistent cough', newPatient: false },
      constraints: {
        dateRange: { from: '2026-11-23', to: '2026-11-29' },
        earliestStart: '15:00',
        excludedWeekdays: [3],
      },
      createdAt: '2026-11-16T13:00:00Z',
    });
    expect(r.visit.shareDetail).toBe(false);
    expect(r.constraints.excludedDates).toEqual([]);
  });
});
