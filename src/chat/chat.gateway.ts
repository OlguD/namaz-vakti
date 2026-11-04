import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser } from '../auth/auth.decorators.js';
import { TokenService } from '../auth/token.service.js';
import { AppError } from '../common/errors.js';
import { ChatBroadcaster, roomChannel } from './chat.broadcaster.js';
import { ChatService, type MessageView } from './chat.service.js';

type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

interface ChatSocket extends Socket {
  data: { user: AuthUser };
}

const ROOM_ID = /^[a-z0-9_-]{1,32}$/;

/**
 * Socket.IO namespace `/chat`.
 *
 * Connect with `io(url + '/chat', { auth: { token: accessToken } })`.
 * Client → server (all acknowledged with `{ ok, data | error }`):
 *   room:join { roomId }            → recent history
 *   room:leave { roomId }
 *   message:send { roomId, body, clientMessageId? }
 *   message:delete { messageId }
 * Server → client:
 *   message:new MessageView
 *   message:removed { id, roomId, reason }
 *   user:removed { userId }
 *
 * Anonymous users may join and read; sending needs a registered, verified account.
 */
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly chat: ChatService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  afterInit(namespace: Namespace): void {
    this.broadcaster.attach(namespace);
    namespace.use(async (socket, next) => {
      const raw = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof raw !== 'string' || raw.length === 0) {
        next(Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } }));
        return;
      }
      try {
        socket.data.user = await this.tokens.verifyAccessToken(raw);
        next();
      } catch {
        next(Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } }));
      }
    });
  }

  handleConnection(socket: ChatSocket): void {
    // Per-user room for future direct notices (mute, ban) to every device of a user.
    void socket.join(`user:${socket.data.user.id}`);
  }

  @SubscribeMessage('room:join')
  join(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { roomId?: unknown },
  ): Promise<Ack<MessageView[]>> {
    return this.handle(async () => {
      const roomId = requireRoomId(body?.roomId);
      const history = await this.chat.history(roomId, socket.data.user.id);
      await socket.join(roomChannel(roomId));
      return history;
    });
  }

  @SubscribeMessage('room:leave')
  leave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { roomId?: unknown },
  ): Promise<Ack<null>> {
    return this.handle(async () => {
      await socket.leave(roomChannel(requireRoomId(body?.roomId)));
      return null;
    });
  }

  @SubscribeMessage('message:send')
  send(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { roomId?: unknown; body?: unknown; clientMessageId?: unknown },
  ): Promise<Ack<MessageView>> {
    return this.handle(async () => {
      const roomId = requireRoomId(body?.roomId);
      if (typeof body.body !== 'string') {
        throw AppError.badRequest('VALIDATION_FAILED', 'body must be a string');
      }
      const clientMessageId =
        typeof body.clientMessageId === 'string' && body.clientMessageId.length <= 64
          ? body.clientMessageId
          : undefined;
      const message = await this.chat.send(socket.data.user, roomId, body.body, clientMessageId);
      this.broadcaster.messageCreated(message);
      return message;
    });
  }

  @SubscribeMessage('message:delete')
  remove(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { messageId?: unknown },
  ): Promise<Ack<null>> {
    return this.handle(async () => {
      const id = Number(body?.messageId);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw AppError.badRequest('VALIDATION_FAILED', 'messageId is invalid');
      }
      const { roomId } = await this.chat.delete(socket.data.user, id);
      this.broadcaster.messageRemoved(roomId, String(id), 'deleted');
      return null;
    });
  }

  private async handle<T>(fn: () => Promise<T>): Promise<Ack<T>> {
    try {
      return { ok: true, data: await fn() };
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          error: { code: error.code, message: error.message, details: error.details },
        };
      }
      if (error instanceof HttpException) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', message: error.message } };
      }
      this.logger.error({ err: error }, 'Chat handler failed');
      return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } };
    }
  }
}

function requireRoomId(value: unknown): string {
  if (typeof value !== 'string' || !ROOM_ID.test(value)) {
    throw AppError.badRequest('VALIDATION_FAILED', 'roomId is invalid');
  }
  return value;
}
