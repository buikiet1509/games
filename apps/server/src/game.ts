import type { Server as HttpServer } from 'node:http';
import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createTempleRoom, type TempleRoomDeps } from './rooms/TempleRoom';

/** Colyseus dùng chung HTTP server với Fastify: một cổng cho cả REST và WebSocket. */
export function createGameServer(
  httpServer: HttpServer,
  deps: TempleRoomDeps & { clientOrigin: string },
) {
  // Mặc định Colyseus lặp lại mọi Origin gửi tới → chỉ cho phép domain client.
  matchMaker.controller.getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': deps.clientOrigin,
    Vary: 'Origin',
  });

  const gameServer = new Server({
    greet: false,
    transport: new WebSocketTransport({ server: httpServer }),
  });
  // Mốc 4: một khu "Chính điện". Mốc 6 mở đủ 5 khu và tự chia bản sao.
  gameServer.define('chinh-dien', createTempleRoom(deps), { areaId: 'chinh-dien' });
  return gameServer;
}
