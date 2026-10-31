import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from 'colyseus.js';
import { matchMaker, type Server } from '@colyseus/core';
import { createTestContext, validUser, type TestContext } from '../../test/helpers';
import { createGameServer } from '../game';

interface PlayerView {
  name: string;
  robeColor: string;
  x: number;
  y: number;
  moving: boolean;
}
interface StateView {
  areaId: string;
  players: Map<string, PlayerView>;
}

let ctx: TestContext;
let gameServer: Server;
let endpoint: string;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.reset();
  gameServer = createGameServer(ctx.app.server, {
    prisma: ctx.prisma,
    accessTokens: ctx.accessTokens,
    clientOrigin: 'http://localhost:5173',
  });
  await gameServer.listen(0);
  endpoint = `ws://localhost:${(ctx.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await gameServer.gracefullyShutdown(false);
  await ctx.prisma.$disconnect();
  ctx.redis.disconnect();
});

async function signUp(username: string, robeColor = '#8B1E1E') {
  const res = await ctx
    .http()
    .post('/api/auth/register')
    .send({ ...validUser, username, email: `${username}@example.com`, robeColor });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

function connect(token?: string) {
  const client = new Client(endpoint);
  if (token) client.auth.token = token;
  return client.joinOrCreate<StateView>('chinh-dien');
}

/** Chờ đến khi điều kiện đúng (state đồng bộ bất đồng bộ qua patch). */
async function until(check: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Hết thời gian chờ');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const playerOf = (room: Room<StateView>, sessionId = room.sessionId) =>
  room.state.players.get(sessionId);

describe('TempleRoom', () => {
  it('matchmaking chỉ cho phép CORS từ domain client', async () => {
    const res = await fetch(endpoint.replace('ws', 'http') + '/matchmake/joinOrCreate/chinh-dien', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('từ chối khi không có token hoặc token sai', async () => {
    await expect(connect()).rejects.toThrow();
    await expect(connect('khong.phai.token')).rejects.toThrow();
    // Room không giữ lại "ghế" nào cho kết nối bị từ chối.
    const rooms = await matchMaker.query({ name: 'chinh-dien' });
    expect(rooms.every((r) => r.clients === 0)).toBe(true);
  });

  describe('hai người chơi', () => {
    let a: Room<StateView>;
    let b: Room<StateView>;

    beforeAll(async () => {
      a = await connect(await signUp('hoa_sen', '#2F6B5A'));
      b = await connect(await signUp('thien_y', '#4F6A9A'));
    });
    afterAll(async () => {
      // leave() trên room đã đóng sẽ treo mãi (không reject) → chỉ gọi khi còn kết nối.
      for (const room of [a, b]) if (room?.connection.isOpen) await room.leave();
    });

    it('vào cùng một room và thấy nhau với đúng tên, màu áo', async () => {
      expect(a.roomId).toBe(b.roomId);
      await until(() => a.state.players?.size === 2 && b.state.players?.size === 2);
      expect(playerOf(a, b.sessionId)).toMatchObject({ name: 'thien_y', robeColor: '#4F6A9A' });
      expect(playerOf(b, a.sessionId)).toMatchObject({ name: 'hoa_sen', robeColor: '#2F6B5A' });
      expect(a.state.areaId).toBe('chinh-dien');
    });

    it('click để đi: server di chuyển nhân vật, người kia thấy vị trí mới', async () => {
      const start = { ...playerOf(a)! };
      const target = { x: start.x < 600 ? start.x + 120 : start.x - 120, y: start.y };
      a.send('move_to', target);
      await until(() => {
        const seenByB = playerOf(b, a.sessionId)!;
        return Math.abs(seenByB.x - target.x) <= 1 && !seenByB.moving;
      });
      expect(playerOf(b, a.sessionId)!.y).toBe(target.y);
    });

    it('giữ phím hướng thì đi liên tục, thả phím thì dừng', async () => {
      const before = playerOf(a)!.y;
      a.send('dir', { x: 0, y: -1 });
      await until(() => playerOf(b, a.sessionId)!.y < before - 20);
      a.send('dir', { x: 0, y: 0 });
      await until(() => playerOf(b, a.sessionId)!.moving === false);
      const stopped = playerOf(b, a.sessionId)!.y;
      await new Promise((r) => setTimeout(r, 250));
      expect(playerOf(b, a.sessionId)!.y).toBe(stopped);
    });

    it('bỏ qua tin nhắn sai định dạng, không làm hỏng state', async () => {
      const before = { ...playerOf(a)! };
      a.send('move_to', { x: 'abc', y: null });
      a.send('dir', { x: 5, y: 0 });
      a.send('teleport', { x: 0, y: 0 });
      await new Promise((r) => setTimeout(r, 250));
      expect(playerOf(b, a.sessionId)).toMatchObject({ x: before.x, y: before.y });
    });

    it('không đi được ra ngoài sân dù client gửi toạ độ bất kỳ', async () => {
      a.send('move_to', { x: -5000, y: 99999 });
      await until(() => playerOf(b, a.sessionId)!.moving === false, 15000);
      const p = playerOf(b, a.sessionId)!;
      expect(p.x).toBeGreaterThanOrEqual(40);
      expect(p.y).toBeLessThanOrEqual(740);
    });

    it('rớt mạng ngoài ý muốn: giữ chỗ và nối lại được bằng reconnection token', async () => {
      const token = b.reconnectionToken;
      const sessionId = b.sessionId;
      b.connection.close(3000); // 4000 là mã "chủ động rời" của Colyseus; mã khác = rớt mạng
      await new Promise((r) => setTimeout(r, 200));
      expect(playerOf(a, sessionId)).toBeDefined();

      b = await new Client(endpoint).reconnect<StateView>(token);
      expect(b.sessionId).toBe(sessionId);
      await until(() => b.state.players?.size === 2);
    });

    it('rời room thì người kia không còn thấy', async () => {
      await b.leave();
      await until(() => a.state.players.size === 1);
      expect(playerOf(a, b.sessionId)).toBeUndefined();
    });
  });
});
