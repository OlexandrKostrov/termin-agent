import { z } from 'zod';

/** Stable, machine-readable error codes. The API maps these to HTTP statuses. */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'ILLEGAL_TRANSITION',
  'POLICY_VIOLATION',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Wire format for every error the system exposes: `{ code, message, details }`. */
export const appErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AppError = z.infer<typeof appErrorSchema>;

export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }

  toAppError(): AppError {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: { ...this.details } };
  }
}

/** Normalises anything thrown into the wire format. Unknown errors never leak their message. */
export function toAppError(error: unknown): AppError {
  if (error instanceof DomainError) return error.toAppError();
  return { code: 'INTERNAL', message: 'Internal error' };
}

/**
 * Parses untrusted input (HTTP bodies, LLM output, scenario files) or throws
 * `VALIDATION_FAILED` with the zod issues as details.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
  what: string,
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new DomainError('VALIDATION_FAILED', `Invalid ${what}`, {
    issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
