import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { AppConfig } from '../config/app-config.service.js';
import { HttpClient, UpstreamError } from '../common/http-client.js';

export interface UsdTryRate {
  rate: number;
  /** Bulletin date, "YYYY-MM-DD". */
  date: string;
}

/**
 * Central Bank of the Republic of Türkiye daily indicative rates — the official
 * USD/TRY reference. Free, no key. Published on business days around 15:30 TR.
 */
@Injectable()
export class TcmbClient {
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.get('TCMB_BASE_URL').replace(/\/$/, '');
    this.http = new HttpClient({
      service: 'tcmb',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 15_000,
      retries: 2,
    });
  }

  async usdTry(): Promise<UsdTryRate> {
    return parseTcmb(await this.http.text(`${this.baseUrl}/kurlar/today.xml`));
  }
}

export function parseTcmb(xml: string): UsdTryRate {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
  const doc = parser.parse(xml) as {
    Tarih_Date?: { '@Date'?: string; Currency?: unknown };
  };
  const root = doc.Tarih_Date;
  const list = Array.isArray(root?.Currency)
    ? root.Currency
    : root?.Currency
      ? [root.Currency]
      : [];
  const usd = (list as Array<Record<string, unknown>>).find(
    (item) => item['@CurrencyCode'] === 'USD' || item['@Kod'] === 'USD',
  );
  const rate = Number(usd?.ForexSelling);
  const unit = Number(usd?.Unit ?? 1);
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(root?.['@Date'] ?? '');
  if (!usd || !Number.isFinite(rate) || rate <= 0 || !dateMatch) {
    throw new UpstreamError('tcmb', 'USD rate missing from bulletin', undefined, false);
  }
  return {
    rate: rate / (Number.isFinite(unit) && unit > 0 ? unit : 1),
    date: `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`,
  };
}

/** Spot prices in USD per troy ounce from goldapi.io (free plan: 500 requests/month). */
@Injectable()
export class GoldApiClient {
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(private readonly config: AppConfig) {
    this.baseUrl = config.get('GOLDAPI_BASE_URL').replace(/\/$/, '');
    this.http = new HttpClient({
      service: 'goldapi',
      userAgent: config.get('OUTBOUND_USER_AGENT'),
      timeoutMs: 15_000,
      retries: 1,
    });
  }

  get configured(): boolean {
    return Boolean(this.config.get('GOLDAPI_KEY'));
  }

  async ounceUsd(metal: 'XAU' | 'XAG'): Promise<number> {
    const response = await this.http.json<{ price?: unknown; metal?: unknown; currency?: unknown }>(
      `${this.baseUrl}/api/${metal}/USD`,
      { headers: { 'x-access-token': this.config.get('GOLDAPI_KEY') ?? '' } },
    );
    const price = Number(response.price);
    if (
      response.metal !== metal ||
      response.currency !== 'USD' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new UpstreamError('goldapi', `unexpected ${metal} quote`, undefined, false);
    }
    return price;
  }
}
