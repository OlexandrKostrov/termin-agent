import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { DomainError, appErrorSchema, parseOrThrow, toAppError } from './errors.js';

describe('parseOrThrow', () => {
  const schema = z.object({ n: z.number() });

  it('returns parsed data', () => {
    expect(parseOrThrow(schema, { n: 1 }, 'thing')).toEqual({ n: 1 });
  });

  it('throws VALIDATION_FAILED with issue paths', () => {
    try {
      parseOrThrow(schema, { n: 'x' }, 'thing');
      expect.unreachable();
    } catch (e) {
      const app = toAppError(e);
      expect(appErrorSchema.parse(app)).toEqual(app);
      expect(app.code).toBe('VALIDATION_FAILED');
      expect(app.message).toBe('Invalid thing');
      expect(app.details?.['issues']).toMatchObject([{ path: 'n' }]);
    }
  });
});

describe('toAppError', () => {
  it('passes domain errors through', () => {
    expect(toAppError(new DomainError('NOT_FOUND', 'No such request'))).toEqual({
      code: 'NOT_FOUND',
      message: 'No such request',
    });
  });

  it('never leaks messages of unexpected errors', () => {
    expect(toAppError(new Error('db password is hunter2'))).toEqual({
      code: 'INTERNAL',
      message: 'Internal error',
    });
    expect(toAppError('boom')).toEqual({ code: 'INTERNAL', message: 'Internal error' });
  });
});
