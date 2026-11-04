import { Module } from '@nestjs/common';
import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';
import { YoutubeClient } from './youtube.client.js';

@Module({
  controllers: [LiveController],
  providers: [LiveService, YoutubeClient],
  exports: [LiveService],
})
export class LiveModule {}
