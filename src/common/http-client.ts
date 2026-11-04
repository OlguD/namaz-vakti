import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

export class UpstreamError extends Error {
  constructor(
    readonly service: string,
    message: string,
    readonly status?: number,
    readonly retryable = true,
  ) {
    super(`${service}: ${message}`);
  }
}

export interface HttpClientOptions {
  /** Name used in logs and errors. */
  service: string;
  userAgent: string;
  timeoutMs?: number;
  retries?: number;
  /** Consecutive failures that open the circuit. */
  breakerThreshold?: number;
  /** How long the circuit stays open before a trial request is allowed. */
  breakerCooldownMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Override the client's retry count for this call. */
  retries?: number;
}

/**
 * Small fetch wrapper for third-party APIs: per-request timeout, retries with
 * jittered exponential backoff on network errors / 429 / 5xx, and an in-process
 * circuit breaker so a dead upstream fails fast instead of piling up requests.
 */
export class HttpClient {
  private readonly logger: Logger;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(private readonly options: HttpClientOptions) {
    this.logger = new Logger(`HttpClient:${options.service}`);
  }

  get circuitOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  async json<T>(url: string, init: RequestOptions = {}): Promise<T> {
    const response = await this.request(url, init);
    try {
      return (await response.json()) as T;
    } catch {
      throw new UpstreamError(
        this.options.service,
        'invalid JSON response',
        response.status,
        false,
      );
    }
  }

  async text(url: string, init: RequestOptions = {}): Promise<string> {
    const response = await this.request(url, init);
    return response.text();
  }

  private async request(url: string, init: RequestOptions): Promise<Response> {
    const { service } = this.options;
    if (this.circuitOpen) {
      throw new UpstreamError(service, 'circuit open');
    }
    const retries = init.retries ?? this.options.retries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) {
        const backoff = Math.min(4_000, 300 * 2 ** (attempt - 1));
        await sleep(backoff / 2 + Math.random() * (backoff / 2));
      }
      try {
        const response = await fetch(url, {
          method: init.method ?? 'GET',
          headers: {
            'User-Agent': this.options.userAgent,
            Accept: 'application/json, text/xml;q=0.9, */*;q=0.5',
            ...init.headers,
          },
          body: init.body,
          signal: AbortSignal.timeout(init.timeoutMs ?? this.options.timeoutMs ?? 10_000),
        });
        if (response.ok) {
          this.recordSuccess();
          return response;
        }
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new UpstreamError(
          service,
          `HTTP ${response.status}`,
          response.status,
          retryable,
        );
        await response.body?.cancel().catch(() => undefined);
        if (!retryable) {
          // A 4xx means our request is wrong, not that the upstream is down.
          throw lastError;
        }
      } catch (error) {
        if (error instanceof UpstreamError && !error.retryable) {
          throw error;
        }
        lastError =
          error instanceof UpstreamError ? error : new UpstreamError(service, describe(error));
      }
    }

    this.recordFailure();
    this.logger.warn(`Request failed after ${retries + 1} attempts: ${describe(lastError)}`);
    throw lastError instanceof UpstreamError
      ? lastError
      : new UpstreamError(service, describe(lastError));
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= (this.options.breakerThreshold ?? 5)) {
      this.openUntil = Date.now() + (this.options.breakerCooldownMs ?? 60_000);
      this.logger.error(`Circuit opened after ${this.consecutiveFailures} consecutive failures`);
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'timeout' : error.message;
  }
  return String(error);
}
