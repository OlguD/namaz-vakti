import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export type UserRole = 'user' | 'moderator' | 'admin';
export type UserKind = 'anonymous' | 'registered';

/** What the access token says about the caller. */
export interface AuthUser {
  id: string;
  kind: UserKind;
  role: UserRole;
  emailVerified: boolean;
}

export const IS_PUBLIC = 'auth:isPublic';
export const REQUIRE_REGISTERED = 'auth:requireRegistered';
export const ROLES = 'auth:roles';

/** No token needed. If one is sent and valid, `@CurrentUser()` is still populated. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Caller must have a full account (social login or verified e-mail), not an anonymous one. */
export const RegisteredOnly = () =>
  applyDecorators(SetMetadata(REQUIRE_REGISTERED, true), ApiBearerAuth());

export const Roles = (...roles: UserRole[]) =>
  applyDecorators(SetMetadata(ROLES, roles), ApiBearerAuth());

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);
