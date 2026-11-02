import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createPrisma } from './db/prisma';
import { createRedis } from './lib/redis';
import { TEST_ENV } from '../test/env';

// Các tính năng phục vụ deploy miễn phí (Render): một origin, email tuỳ chọn, IP người dùng.
const prisma = createPrisma(TEST_ENV.DATABASE_URL);
const redis = createRedis(TEST_ENV.REDIS_URL);
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

async function appWith(env: Record<string, string>, mailer?: null) {
  const config = loadConfig({ ...TEST_ENV, ...env });
  const { app } = await buildApp(config, { prisma, redis, mailer });
  await app.ready();
  return app;
}

describe('cấu hình cho Render', () => {
  it('CLIENT_ORIGIN tự lấy từ RENDER_EXTERNAL_URL khi chưa đặt', () => {
    const c = loadConfig({ ...TEST_ENV, RENDER_EXTERNAL_URL: 'https://chua-an-lac.onrender.com' });
    expect(c.CLIENT_ORIGIN).toBe('https://chua-an-lac.onrender.com');
    const explicit = loadConfig({
      ...TEST_ENV,
      CLIENT_ORIGIN: 'https://chua.example.com',
      RENDER_EXTERNAL_URL: 'https://x.onrender.com',
    });
    expect(explicit.CLIENT_ORIGIN).toBe('https://chua.example.com');
  });

  it('trên Render tự lấy IP thật từ cf-connecting-ip (trừ khi đặt CLIENT_IP_HEADER khác)', () => {
    expect(loadConfig({ ...TEST_ENV, RENDER: 'true' }).CLIENT_IP_HEADER).toBe('cf-connecting-ip');
    expect(
      loadConfig({ ...TEST_ENV, RENDER: 'true', CLIENT_IP_HEADER: 'true-client-ip' })
        .CLIENT_IP_HEADER,
    ).toBe('true-client-ip');
    expect(loadConfig({ ...TEST_ENV }).CLIENT_IP_HEADER).toBeUndefined();
  });

  it('production không có email vẫn khởi động được', () => {
    expect(() =>
      loadConfig({
        ...TEST_ENV,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'prod-secret-0123456789abcdefghijklmnopq',
      }),
    ).not.toThrow();
  });
});

describe('phục vụ trang web cùng địa chỉ với API', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chua-client-'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Chùa An Lạc Online</title>');
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');

  it('trả index.html, file assets cache lâu; đường dẫn của ứng dụng (vd. đặt lại mật khẩu) cũng trả index.html', async () => {
    const app = await appWith({ SERVE_CLIENT_DIR: dir });
    const http = () => request(app.server);

    const home = await http().get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('Chùa An Lạc Online');
    expect(home.headers['cache-control']).toBe('no-cache');

    const asset = await http().get('/assets/app-abc123.js');
    expect(asset.headers['cache-control']).toContain('immutable');

    const spa = await http().get('/dat-lai-mat-khau?token=abc');
    expect(spa.status).toBe(200);
    expect(spa.text).toContain('Chùa An Lạc Online');

    // API và file không tồn tại vẫn trả 404 (không nhầm thành trang web).
    expect((await http().get('/api/khong-co')).status).toBe(404);
    expect((await http().get('/assets/khong-co.js')).status).toBe(404);
    expect((await http().get('/health')).body.status).toBe('ok');
    await app.close();
  });
});

describe('email tuỳ chọn & IP người dùng', () => {
  it('chưa cấu hình email → quên mật khẩu báo chưa bật (503)', async () => {
    const app = await appWith({}, null);
    const res = await request(app.server).post('/api/auth/forgot').send({ email: 'a@b.vn' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/chưa bật/);
    await app.close();
  });

  it('/api/ip trả IP lấy từ header nền tảng nếu được cấu hình', async () => {
    const app = await appWith({ CLIENT_IP_HEADER: 'CF-Connecting-IP' });
    const res = await request(app.server).get('/api/ip').set('cf-connecting-ip', '203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
    await app.close();
  });
});
