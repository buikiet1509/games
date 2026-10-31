import type { Server as HttpServer } from 'node:http';
import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { AREAS } from '@chua/shared';
import { createTempleRoom } from './rooms/TempleRoom';
import type { GameServices } from './services';

/** Colyseus dùng chung HTTP server với Fastify: một cổng cho cả REST và WebSocket. */
export function createGameServer(
  httpServer: HttpServer,
  services: GameServices,
  opts: { clientOrigin: string; areas?: readonly string[] },
) {
  // Mặc định Colyseus lặp lại mọi Origin gửi tới → chỉ cho phép domain client.
  matchMaker.controller.getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': opts.clientOrigin,
    Vary: 'Origin',
  });

  const gameServer = new Server({
    greet: false,
    transport: new WebSocketTransport({ server: httpServer }),
  });
  const TempleRoom = createTempleRoom(services);
  // Mỗi khu một loại room; joinOrCreate tự mở bản sao khi các room hiện có đã đầy.
  for (const area of AREAS) {
    if (!opts.areas || opts.areas.includes(area.id)) {
      gameServer.define(area.id, TempleRoom, { areaId: area.id });
    }
  }
  return gameServer;
}
