import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import {
  AnonymousLoginDto,
  AppleLoginDto,
  AuthResponseDto,
  EmailLoginDto,
  EmailRegisterDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  RefreshDto,
  ResetPasswordDto,
  TokenDto,
  TokenPairDto,
} from './dto.js';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('anonymous')
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Create an anonymous account',
    description:
      'Called on first launch. Everything except chat works with an anonymous account; it can later be upgraded in place with Apple, Google or e-mail sign-in.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  anonymous(@Body() body: AnonymousLoginDto, @Headers('user-agent') ua?: string) {
    return this.auth.anonymous(body, ua);
  }

  @Public()
  @Post('apple')
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign in with Apple',
    description:
      'Send the current anonymous access token (optional) to upgrade that account instead of creating a new one.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  apple(
    @Body() body: AppleLoginDto,
    @CurrentUser() caller?: AuthUser,
    @Headers('user-agent') ua?: string,
  ) {
    return this.auth.apple(body.identityToken, body.nonce, body.displayName, caller, ua);
  }

  @Public()
  @Post('google')
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign in with Google', description: 'Same upgrade rules as Apple.' })
  @ApiOkResponse({ type: AuthResponseDto })
  google(
    @Body() body: GoogleLoginDto,
    @CurrentUser() caller?: AuthUser,
    @Headers('user-agent') ua?: string,
  ) {
    return this.auth.google(body.idToken, body.displayName, caller, ua);
  }

  @Public()
  @Post('email/register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register with e-mail and password; sends a verification e-mail' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(
    @Body() body: EmailRegisterDto,
    @CurrentUser() caller?: AuthUser,
    @Headers('user-agent') ua?: string,
  ) {
    return this.auth.registerWithEmail(body.email, body.password, body.displayName, caller, ua);
  }

  @Public()
  @Post('email/login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() body: EmailLoginDto, @Headers('user-agent') ua?: string) {
    return this.auth.loginWithEmail(body.email, body.password, ua);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(204)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Confirm an e-mail address; refresh tokens afterwards to get updated claims',
  })
  @ApiNoContentResponse()
  async verify(@Body() body: TokenDto): Promise<void> {
    await this.auth.verifyEmail(body.token);
  }

  @Post('email/resend-verification')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async resend(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.resendVerification(user.id);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiNoContentResponse()
  async forgot(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Set a new password; signs out every session' })
  @ApiNoContentResponse()
  async reset(@Body() body: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(body.token, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
  @ApiOkResponse({ type: TokenPairDto })
  refresh(@Body() body: RefreshDto, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(body.refreshToken, ua);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(@Body() body: RefreshDto): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }
}
