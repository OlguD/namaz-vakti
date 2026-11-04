import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { AppConfig } from './config/app-config.service.js';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
await configureApp(app);
await app.listen(app.get(AppConfig).get('PORT'), '0.0.0.0');
