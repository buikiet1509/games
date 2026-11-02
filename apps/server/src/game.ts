import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { matchMaker, Server, type Presence } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { AREAS } from '@chua/shared';
import { createTempleRoom } from './rooms/TempleRoom';
import type { GameServices } from './services';

const MACHINES_KEY = 'fly:machines';

export interface GameServerOptions {
  clientOrigin: string;
  areas?: readonly string[];
  /** Có giá trị → chạy nhiều instance, chia sẻ room qua Redis. */
  redisUrl?: string;
  /** Mã máy Fly.io của instance này (biến FLY_MACHINE_ID). */
  flyMachineId?: string;
}

/**
 * Colyseus dùng chung HTTP server với Fastify: một cổng cho cả REST và WebSocket.
 *
 * Nhiều instance (Fly.io): matchmaking chạy ở máy nào cũng được (room chia sẻ qua Redis),
 * nhưng WebSocket phải tới đúng máy đang giữ room. Client nối tới `/{processId}/{roomId}`;
 * máy nhận nhầm trả header `fly-replay: instance=<máy đúng>` để proxy của Fly chuyển tiếp.
 */
export function createGameServer(
  httpServer: HttpServer,
  services: GameServices,
  opts: GameServerOptions,
) {
  // Mặc định Colyseus lặp lại mọi Origin gửi tới → chỉ cho phép domain client.
  matchMaker.controller.getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': opts.clientOrigin,
    Vary: 'Origin',
  });

  const presence = opts.redisUrl ? new RedisPresence(opts.redisUrl) : undefined;
  const routing =
    presence && opts.flyMachineId ? flyRouting(presence, opts.flyMachineId) : undefined;

  const gameServer = new Server({
    greet: false,
    // Tự xử lý SIGTERM ở index.ts: Colyseus mặc định tự tắt và thoát process, có thể thoát
    // trước khi kịp ghi nốt phước/lời nguyện đang chờ trong hàng đợi.
    gracefullyShutdown: false,
    presence,
    driver: opts.redisUrl ? new RedisDriver(opts.redisUrl) : undefined,
    transport: new WebSocketTransport({ server: httpServer, verifyClient: routing?.verifyClient }),
  });
  const TempleRoom = createTempleRoom(services);
  // Mỗi khu một loại room; joinOrCreate tự mở bản sao khi các room hiện có đã đầy.
  for (const area of AREAS) {
    if (!opts.areas || opts.areas.includes(area.id)) {
      gameServer.define(area.id, TempleRoom, { areaId: area.id });
    }
  }
  return Object.assign(gameServer, {
    /** Gọi sau listen(): đăng ký processId → máy Fly để các máy khác biết chuyển tiếp. */
    registerMachine: () => routing?.register() ?? Promise.resolve(),
    unregisterMachine: () => routing?.unregister() ?? Promise.resolve(),
  });
}

type VerifyCallback = (
  ok: boolean,
  code?: number,
  message?: string,
  headers?: Record<string, string>,
) => void;

/** Định tuyến WebSocket giữa các máy Fly.io bằng header fly-replay. */
export function flyRouting(
  presence: Presence,
  machineId: string,
  ownProcessId: () => string = () => matchMaker.processId,
) {
  return {
    async register() {
      await presence.hset(MACHINES_KEY, ownProcessId(), machineId);
    },
    async unregister() {
      await presence.hdel(MACHINES_KEY, ownProcessId());
    },
    verifyClient(info: { req: IncomingMessage }, cb: VerifyCallback) {
      const processId = info.req.url?.split('?')[0]?.split('/')[1];
      if (!processId || processId === ownProcessId()) return cb(true);
      presence
        .hget(MACHINES_KEY, processId)
        .then((target) => {
          if (target && target !== machineId) {
            cb(false, 409, 'Chuyển tới máy giữ room', { 'fly-replay': `instance=${target}` });
          } else cb(true); // không rõ máy nào → để Colyseus tự xử lý (từ chối nếu không có room)
        })
        .catch(() => cb(true));
    },
  };
}
