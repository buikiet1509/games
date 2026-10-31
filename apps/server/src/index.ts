import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createPrisma } from './db/prisma';
import { createRedis } from './lib/redis';

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const redis = createRedis(config.REDIS_URL);
const app = await buildApp(config, { prisma, redis });
await app.ready();

// Colyseus dùng chung HTTP server với Fastify: một cổng cho cả REST và WebSocket.
const gameServer = new Server({
  transport: new WebSocketTransport({ server: app.server }),
});

await gameServer.listen(config.PORT);
app.log.info(`Server đang chạy tại http://localhost:${config.PORT}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await gameServer.gracefullyShutdown(false);
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
