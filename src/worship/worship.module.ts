import { Module } from '@nestjs/common';
import { QuranController } from '../quran/quran.controller.js';
import { QuranService } from '../quran/quran.service.js';
import { WorshipController } from './worship.controller.js';
import { WorshipService } from './worship.service.js';

@Module({
  controllers: [WorshipController, QuranController],
  providers: [WorshipService, QuranService],
  exports: [WorshipService, QuranService],
})
export class WorshipModule {}
