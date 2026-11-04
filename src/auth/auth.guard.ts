import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../common/errors.js';
import {
  type AuthUser,
  IS_PUBLIC,
  REQUIRE_REGISTERED,
  ROLES,
  type UserRole,
} from './auth.decorators.js';
import { TokenService } from './token.service.js';

/**
 * Global guard. Every route needs a valid access token unless marked `@Public()`.
 * Anonymous accounts get tokens too, so "authenticated" ≠ "registered":
 * `@RegisteredOnly()` and `@Roles()` narrow further.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;

    const token = extractBearer(request.headers.authorization);
    if (token) {
      try {
        request.user = await this.tokens.verifyAccessToken(token);
      } catch (error) {
        if (!isPublic) {
          throw error;
        }
      }
    }
    if (isPublic) {
      return true;
    }
    const user = request.user;
    if (!user) {
      throw AppError.unauthenticated();
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) {
      throw AppError.forbidden();
    }
    const registeredOnly =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_REGISTERED, targets) ?? false;
    if (registeredOnly) {
      assertRegistered(user);
    }
    return true;
  }
}

export function assertRegistered(user: AuthUser): void {
  if (user.kind !== 'registered') {
    throw AppError.forbidden('Sign in with Apple, Google or e-mail to use this feature');
  }
  if (!user.emailVerified) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your e-mail address first', 403);
  }
}

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}
