import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ChatIoAdapter } from './chat/chat-io.adapter.js';
import { AppConfig } from './config/app-config.service.js';

/**
 * HTTP pipeline shared by main.ts and the e2e tests, so tests exercise exactly
 * what production runs.
 */
export async function configureApp(app: INestApplication): Promise<void> {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;

  app.useLogger(app.get(Logger));
  if (config.get('TRUST_PROXY')) {
    // Behind Traefik: take the client IP from X-Forwarded-For (rate limits, logs).
    express.set('trust proxy', 1);
  }
  express.disable('x-powered-by');
  app.use(helmet());
  // Only the listed web origins may call the API from a browser; credentials are
  // allowed so the refresh cookie can be sent to /v1/auth.
  const origins = config.get('CORS_ORIGINS');
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: origins.length > 0,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Client-Platform', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const ioAdapter = new ChatIoAdapter(app, origins);
  await ioAdapter.connectToRedis(config.get('REDIS_URL'));
  app.useWebSocketAdapter(ioAdapter);

  if (config.get('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Namaz Vakti API')
        .setDescription(
          'Backend for the Namaz Vakti mobile app. Errors always look like `{ "error": { "code", "message", "details?" } }`. Chat runs over Socket.IO on the `/chat` namespace — see README.',
        )
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
  }

  app.enableShutdownHooks();
}
