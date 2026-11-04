import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ChatBroadcaster } from './chat.broadcaster.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [UsersModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatBroadcaster],
  exports: [ChatService, ChatBroadcaster],
})
export class ChatModule {}
