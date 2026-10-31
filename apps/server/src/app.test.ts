import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../test/helpers';

describe('HTTP app', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('GET /health trả về ok', async () => {
    const res = await ctx.http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('có security headers từ helmet', async () => {
    const res = await ctx.http().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS chỉ cho phép domain client', async () => {
    const res = await ctx.http().get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('route không tồn tại trả 404 không lộ chi tiết', async () => {
    const res = await ctx.http().get('/khong-co');
    expect(res.status).toBe(404);
  });
});
