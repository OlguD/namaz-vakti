import { Module } from '@nestjs/common';
import { MosquesController } from './mosques.controller.js';
import { MosquesService } from './mosques.service.js';
import { OverpassClient } from './overpass.client.js';

@Module({
  controllers: [MosquesController],
  providers: [MosquesService, OverpassClient],
  exports: [MosquesService],
})
export class MosquesModule {}
