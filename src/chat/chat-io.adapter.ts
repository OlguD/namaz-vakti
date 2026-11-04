import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO over a Redis pub/sub adapter so messages reach clients connected to
 * any API replica.
 */
export class ChatIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    /** Browser origins allowed to open a socket (the web app). Native apps send no Origin. */
    private readonly origins: string[] = [],
  ) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pub = new Redis(url, { lazyConnect: true });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    this.clients = [pub, sub];
    this.adapterConstructor = createAdapter(pub, sub, { key: 'nv:socket.io' });
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...(options as ServerOptions),
      cors: { origin: this.origins.length > 0 ? this.origins : false },
      // Reject browser handshakes from other sites even when they skip CORS (e.g. plain WebSocket).
      allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        callback(null, !origin || this.origins.includes(origin));
      },
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 16 * 1024,
      connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
    } satisfies Partial<ServerOptions>) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(this.clients.map((client) => client.quit().catch(() => undefined)));
  }
}
