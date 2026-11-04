import { AppError } from '../common/errors.js';
import { addDays, isIsoDate, localDate } from '../prayer-times/time-utils.js';

/**
 * Worship data is keyed by the user's own calendar day, which only the device
 * knows (it depends on the user's time zone), so clients send it. We only check
 * that it is a real date and not absurdly far from now.
 */
export function assertUserDate(value: string, field = 'date'): string {
  if (!isIsoDate(value)) {
    throw AppError.badRequest('VALIDATION_FAILED', `${field} must be YYYY-MM-DD`, { field });
  }
  const today = localDate(new Date(), 'UTC');
  if (value < '2000-01-01' || value > addDays(today, 1)) {
    throw AppError.badRequest('VALIDATION_FAILED', `${field} is out of range`, { field });
  }
  return value;
}

/** A planning date (khatm target): may lie up to ten years ahead. */
export function assertFutureDate(value: string, field = 'date'): string {
  if (!isIsoDate(value)) {
    throw AppError.badRequest('VALIDATION_FAILED', `${field} must be YYYY-MM-DD`, { field });
  }
  const today = localDate(new Date(), 'UTC');
  if (value < addDays(today, -1) || value > addDays(today, 3653)) {
    throw AppError.badRequest('VALIDATION_FAILED', `${field} is out of range`, { field });
  }
  return value;
}

export function assertRange(from: string, to: string, maxDays: number): void {
  assertUserDate(from, 'from');
  assertUserDate(to, 'to');
  if (from > to) {
    throw AppError.badRequest('VALIDATION_FAILED', 'from must not be after to');
  }
  if (addDays(from, maxDays - 1) < to) {
    throw AppError.badRequest('VALIDATION_FAILED', `The range may span at most ${maxDays} days`);
  }
}

/**
 * Length of the run of consecutive active days ending today, or ending
 * yesterday when nothing has been done yet today (the streak is not broken
 * until the day is over).
 */
export function streakLength(activeDays: Set<string>, today: string): number {
  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  let length = 0;
  while (activeDays.has(cursor)) {
    length += 1;
    cursor = addDays(cursor, -1);
  }
  return length;
}
