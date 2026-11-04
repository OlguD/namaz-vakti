import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { AppError } from '../common/errors.js';
import { AppConfig } from '../config/app-config.service.js';
import type { TokenPair } from './token.service.js';

/**
 * Browser sessions.
 *
 * Native apps keep both tokens in the OS keychain and get them in the response
 * body. In a browser any script on the page could read a body token kept in
 * localStorage, so for web clients the refresh token only ever travels in an
 * httpOnly, Secure, SameSite cookie scoped to /v1/auth; the page keeps just the
 * short-lived access token in memory.
 *
 * A request is treated as a web client when it sends `X-Client-Platform: web`.
 * Using the cookie additionally requires an allow-listed Origin; together with
 * the custom header (which forces a CORS preflight) and SameSite this blocks
 * cross-site request forgery.
 */
export const REFRESH_COOKIE = 'nv_rt';
export const CLIENT_HEADER = 'x-client-platform';
const COOKIE_PATH = '/v1/auth';

export function isWebClient(req: Request): boolean {
  return String(req.headers[CLIENT_HEADER] ?? '').toLowerCase() === 'web';
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

@Injectable()
export class WebSession {
  constructor(private readonly config: AppConfig) {}

  /** Rejects cookie use from origins that are not our web app. */
  assertTrustedOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (!origin || !this.config.get('CORS_ORIGINS').includes(origin)) {
      throw new AppError('FORBIDDEN', 'Untrusted origin', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * The refresh token for this request: from the body for native apps, from the
   * cookie for web clients on a trusted origin.
   */
  refreshTokenFrom(req: Request, bodyToken: string | undefined): string | undefined {
    if (bodyToken) {
      return bodyToken;
    }
    if (!isWebClient(req)) {
      return undefined;
    }
    this.assertTrustedOrigin(req);
    return readCookie(req, REFRESH_COOKIE);
  }

  setRefreshCookie(res: Response, pair: TokenPair): void {
    res.cookie(REFRESH_COOKIE, pair.refreshToken, {
      ...this.cookieOptions(),
      expires: new Date(pair.refreshTokenExpiresAt),
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    const sameSite = this.config.get('WEB_COOKIE_SAMESITE');
    return {
      httpOnly: true,
      // SameSite=None is only honoured on Secure cookies.
      secure: this.config.get('WEB_COOKIE_SECURE') || sameSite === 'none',
      sameSite,
      path: COOKIE_PATH,
      domain: this.config.get('WEB_COOKIE_DOMAIN') || undefined,
    } as const;
  }
}

function isTokenPair(value: unknown): value is TokenPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TokenPair).refreshToken === 'string' &&
    typeof (value as TokenPair).accessToken === 'string'
  );
}

/**
 * On auth responses to web clients: move the refresh token from the body into
 * the cookie. Handles both `{ tokens, user }` and a bare token pair.
 */
@Injectable()
export class WebTokenInterceptor implements NestInterceptor {
  constructor(private readonly web: WebSession) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (!isWebClient(req)) {
      return next.handle();
    }
    // Checked before the handler runs, so an untrusted page never gets a session minted.
    this.web.assertTrustedOrigin(req);
    return next.handle().pipe(
      map((body: unknown) => {
        const nested = (body as { tokens?: unknown } | null)?.tokens;
        const pair = isTokenPair(nested) ? nested : isTokenPair(body) ? body : undefined;
        if (!pair) {
          return body;
        }
        this.web.setRefreshCookie(res, pair);
        const stripped = { ...pair, refreshToken: null };
        return isTokenPair(nested) ? { ...(body as object), tokens: stripped } : stripped;
      }),
    );
  }
}
