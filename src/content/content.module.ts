import { Module } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';
import {
  ContentAdminController,
  ContentController,
  SettingsController,
} from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  controllers: [ContentController, ContentAdminController, SettingsController],
  providers: [ContentService, SettingsService],
  exports: [ContentService, SettingsService],
})
export class ContentModule {}
