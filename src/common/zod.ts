import type { z } from 'zod';
import { AppError } from './errors.js';

/** Parses with a zod schema and turns problems into a 400 in the API's error shape. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('VALIDATION_FAILED', 'Request validation failed', {
      issues: result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    });
  }
  return result.data;
}
