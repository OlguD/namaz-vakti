import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, type ErrorCode } from './errors.js';

interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
  requestId?: string;
}

const statusToCode: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'UPSTREAM_UNAVAILABLE',
};

/** Every HTTP error leaves the API in one shape: `{ error: { code, message, details? } }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { status, body } = this.toBody(exception);
    // Known upstream outages (503 AppError) are expected and logged where they occur.
    if (status >= 500 && !(exception instanceof AppError)) {
      this.logger.error(
        { err: exception, path: request.url, method: request.method },
        'Unhandled error',
      );
    }
    body.requestId = typeof request.id === 'string' ? request.id : undefined;
    response.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        body: {
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const code = statusToCode[status] ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED');
      let message = exception.message;
      let details: Record<string, unknown> | undefined;
      if (typeof raw === 'object' && raw !== null && 'message' in raw) {
        const value = (raw as { message: unknown }).message;
        if (Array.isArray(value)) {
          message = 'Request validation failed';
          details = { issues: value };
        } else if (typeof value === 'string') {
          message = value;
        }
      }
      return { status, body: { error: { code, message, details } } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL', message: 'Something went wrong' } },
    };
  }
}
