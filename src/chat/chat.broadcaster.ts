import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { MessageView } from './chat.service.js';

export const roomChannel = (roomId: string) => `room:${roomId}`;

/**
 * Lets REST endpoints and admin actions push events to sockets. The gateway hands
 * over its server on init; with the Redis adapter, emits reach every replica.
 */
@Injectable()
export class ChatBroadcaster {
  private server?: Namespace;

  attach(server: Namespace): void {
    this.server = server;
  }

  messageCreated(message: MessageView): void {
    this.server?.to(roomChannel(message.roomId)).emit('message:new', message);
  }

  messageRemoved(roomId: string, messageId: string, reason: 'deleted' | 'hidden'): void {
    this.server?.to(roomChannel(roomId)).emit('message:removed', { id: messageId, roomId, reason });
  }

  /** Remove every message by a user from open clients (ban / account deletion). */
  userRemoved(userId: string): void {
    this.server?.emit('user:removed', { userId });
  }
}
