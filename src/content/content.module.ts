import { Module } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';
import {
  ContentAdminController,
  ContentController,
  SettingsController,
} from './content.controller.js';
import { AladhanClient } from '../calendar/aladhan.client.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { ContentService } from './content.service.js';
import { GoldApiClient, TcmbClient } from './metal-prices.clients.js';
import { MetalPricesService } from './metal-prices.service.js';

@Module({
  controllers: [ContentController, ContentAdminController, SettingsController],
  providers: [
    ContentService,
    SettingsService,
    CalendarService,
    AladhanClient,
    MetalPricesService,
    TcmbClient,
    GoldApiClient,
  ],
  exports: [ContentService, SettingsService, CalendarService, MetalPricesService],
})
export class ContentModule {}
