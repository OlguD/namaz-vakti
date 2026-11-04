import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient, UpstreamError } from '../common/http-client.js';

export interface HijriMonthSpan {
  /** Gregorian date of the 1st, "YYYY-MM-DD". */
  start: string;
  length: number;
}

interface CalendarItem {
  hijri?: { day?: string; month?: { number?: number }; year?: string };
  gregorian?: { date?: string };
}

/**
 * Aladhan's hijri→Gregorian month calendar with calendarMethod=DIYANET (Diyanet's
 * astronomical Hijri calendar). Free, no key. Only used for months for which we
 * do not yet hold Diyanet's own daily tables.
 */
@Injectable()
export class AladhanClient {
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.get('ALADHAN_BASE_URL').replace(/\/$/, '');
    this.http = new HttpClient({
      service: 'aladhan',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 15_000,
      retries: 2,
    });
  }

  async month(hijriMonth: number, hijriYear: number): Promise<HijriMonthSpan> {
    const response = await this.http.json<{ code?: number; data?: CalendarItem[] }>(
      `${this.baseUrl}/v1/hToGCalendar/${hijriMonth}/${hijriYear}?calendarMethod=DIYANET`,
    );
    return parseMonth(response.data, hijriMonth, hijriYear);
  }
}

/** "DD-MM-YYYY" → "YYYY-MM-DD" */
function toIso(value: string | undefined): string | undefined {
  const match = value ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(value) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

export function parseMonth(
  items: CalendarItem[] | undefined,
  hijriMonth: number,
  hijriYear: number,
): HijriMonthSpan {
  if (!Array.isArray(items) || items.length < 29 || items.length > 30) {
    throw new UpstreamError(
      'aladhan',
      `unexpected month length for ${hijriMonth}/${hijriYear}`,
      undefined,
      false,
    );
  }
  const first = items[0]!;
  if (
    Number(first.hijri?.day) !== 1 ||
    first.hijri?.month?.number !== hijriMonth ||
    Number(first.hijri?.year) !== hijriYear
  ) {
    throw new UpstreamError(
      'aladhan',
      `month ${hijriMonth}/${hijriYear} does not start on day 1`,
      undefined,
      false,
    );
  }
  const start = toIso(first.gregorian?.date);
  if (!start) {
    throw new UpstreamError('aladhan', 'missing gregorian date', undefined, false);
  }
  return { start, length: items.length };
}
