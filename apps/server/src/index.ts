import { buildApp } from './app';
import { createGameServer } from './game';
import { loadConfig } from './config';
import { createPrisma } from './db/prisma';
import { createRedis } from './lib/redis';
import { createGameServices } from './services';

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const redis = createRedis(config.REDIS_URL);
const { app, accessTokens } = await buildApp(config, { prisma, redis });
await app.ready();

const services = createGameServices({
  prisma,
  redis,
  accessTokens,
  log: app.log,
  profanityExtra: config.PROFANITY_EXTRA,
});
if (await services.leaderboard.rebuildIfEmpty(prisma)) {
  app.log.info('Đã dựng lại bảng công đức từ lịch sử công đức');
}
services.start();
const gameServer = createGameServer(app.server, services, {
  clientOrigin: config.CLIENT_ORIGIN,
  redisUrl: config.COLYSEUS_REDIS ? config.REDIS_URL : undefined,
  flyMachineId: config.FLY_MACHINE_ID,
});

await gameServer.listen(config.PORT);
await gameServer.registerMachine();
app.log.info(`Server đang chạy tại http://localhost:${config.PORT}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await gameServer.unregisterMachine().catch(() => {});
  await gameServer.gracefullyShutdown(false);
  await services.stop(); // ghi nốt phước và lời nguyện còn trong hàng đợi
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
