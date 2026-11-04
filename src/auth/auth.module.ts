import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.service.js';
import { MailService } from '../mail/mail.service.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SocialVerifier } from './social-verifier.service.js';
import { TokenService } from './token.service.js';
import { WebSession, WebTokenInterceptor } from './web-session.js';
import { AccessRevocation } from './access-revocation.service.js';

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ secret: config.get('JWT_ACCESS_SECRET') }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    SocialVerifier,
    MailService,
    AuthGuard,
    WebSession,
    WebTokenInterceptor,
    AccessRevocation,
  ],
  exports: [TokenService, AuthGuard, MailService, AccessRevocation],
})
export class AuthModule {}
