import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { LiveModule } from '../live/live.module.js';
import { MosquesModule } from '../mosques/mosques.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [ChatModule, LiveModule, MosquesModule, NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
