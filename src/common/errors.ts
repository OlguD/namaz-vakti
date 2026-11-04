import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable machine-readable error codes. The mobile app switches on `code`, never on
 * the message, so messages can be reworded or localised freely.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_TAKEN'
  | 'DISPLAY_NAME_TAKEN'
  | 'DISPLAY_NAME_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_REUSED'
  | 'ACCOUNT_BANNED'
  | 'REGISTRATION_REQUIRED'
  | 'CHAT_MUTED'
  | 'SLOW_MODE'
  | 'MESSAGE_REJECTED'
  | 'LOCATION_UNSUPPORTED'
  | 'FEATURE_DISABLED';

export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(what: string): AppError {
    return new AppError('NOT_FOUND', `${what} not found`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'You are not allowed to do this'): AppError {
    return new AppError('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, HttpStatus.CONFLICT);
  }

  static badRequest(code: ErrorCode, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static upstream(service: string): AppError {
    return new AppError(
      'UPSTREAM_UNAVAILABLE',
      `${service} is temporarily unavailable`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
