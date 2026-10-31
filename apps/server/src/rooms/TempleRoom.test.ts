import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from 'colyseus.js';
import { matchMaker, type Server } from '@colyseus/core';
import {
  HALL_SEATS,
  type ActivityItem,
  type LeaderboardEntry,
  type ServerMessages,
} from '@chua/shared';
import { createTestContext, validUser, type TestContext } from '../../test/helpers';
import { createGameServer } from '../game';
import { createGameServices, type GameServices } from '../services';

interface PlayerView {
  name: string;
  robeColor: string;
  x: number;
  y: number;
  moving: boolean;
  action: string;
}
interface StateView {
  areaId: string;
  zone: number;
  players: Map<string, PlayerView>;
}

/** Room kèm hộp thư ghi lại mọi tin nhắn server gửi tới. */
interface TestRoom extends Room<StateView> {
  inbox: { type: string; data: unknown }[];
}

let ctx: TestContext;
let services: GameServices;
let gameServer: Server;
let endpoint: string;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.reset();
  services = createGameServices({
    prisma: ctx.prisma,
    redis: ctx.redis,
    accessTokens: ctx.accessTokens,
    log: ctx.app.log,
    profanityExtra: [],
  });
  gameServer = createGameServer(ctx.app.server, services, {
    clientOrigin: 'http://localhost:5173',
  });
  await gameServer.listen(0);
  endpoint = `ws://localhost:${(ctx.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await gameServer.gracefullyShutdown(false);
  await services.stop();
  await ctx.prisma.$disconnect();
  ctx.redis.disconnect();
});

let userSeq = 0;
async function signUp(robeColor = '#8B1E1E') {
  // Test tạo rất nhiều tài khoản từ cùng một IP → xoá bộ đếm giới hạn đăng ký.
  const keys = await ctx.redis.keys('rl:register:*');
  if (keys.length) await ctx.redis.del(...keys);
  const username = `phat_tu_${++userSeq}`;
  const res = await ctx
    .http()
    .post('/api/auth/register')
    .send({ ...validUser, username, email: `${username}@example.com`, robeColor });
  expect(res.status).toBe(201);
  return { username, token: res.body.accessToken as string, id: res.body.user.id as string };
}

async function connect(token?: string, area = 'chinh-dien', options = {}): Promise<TestRoom> {
  const client = new Client(endpoint);
  if (token) client.auth.token = token;
  const room = (await client.joinOrCreate<StateView>(area, options)) as TestRoom;
  room.inbox = [];
  room.onMessage('*', (type, data) => room.inbox.push({ type: String(type), data }));
  return room;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chờ đến khi điều kiện đúng (state/tin nhắn đến bất đồng bộ). */
async function until(check: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Hết thời gian chờ');
    await sleep(20);
  }
}

/** Chờ tin nhắn loại `type` (thoả `match`) xuất hiện trong hộp thư, bắt đầu từ `from`. */
async function nextMessage<K extends keyof ServerMessages>(
  room: TestRoom,
  type: K,
  match: (data: ServerMessages[K]) => boolean = () => true,
  timeoutMs = 3000,
) {
  let found: ServerMessages[K] | undefined;
  await until(() => {
    const hit = room.inbox.find((m) => m.type === type && match(m.data as ServerMessages[K]));
    if (hit) {
      room.inbox.splice(room.inbox.indexOf(hit), 1);
      found = hit.data as ServerMessages[K];
    }
    return found !== undefined;
  }, timeoutMs);
  return found!;
}

const playerOf = (room: Room<StateView>, sessionId = room.sessionId) =>
  room.state.players.get(sessionId);

async function walkTo(room: TestRoom, x: number, y: number) {
  room.send('move_to', { x, y });
  await sleep(150);
  await until(() => playerOf(room)!.moving === false, 8000);
}

const leave = async (...rooms: (Room | undefined)[]) => {
  // leave() trên room đã đóng sẽ treo mãi (không reject) → chỉ gọi khi còn kết nối.
  for (const room of rooms) if (room?.connection.isOpen) await room.leave();
};

describe('kết nối & di chuyển', () => {
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
    const rooms = await matchMaker.query({ name: 'chinh-dien' });
    expect(rooms.every((r) => r.clients === 0)).toBe(true);
  });

  describe('hai người chơi', () => {
    let a: TestRoom;
    let b: TestRoom;
    let aName: string;

    beforeAll(async () => {
      const ua = await signUp('#2F6B5A');
      aName = ua.username;
      a = await connect(ua.token, 'san-chua');
      b = await connect((await signUp('#4F6A9A')).token, 'san-chua');
    });
    afterAll(() => leave(a, b));

    it('vào cùng một room và thấy nhau với đúng tên, màu áo', async () => {
      expect(a.roomId).toBe(b.roomId);
      await until(() => a.state.players?.size === 2 && b.state.players?.size === 2);
      expect(playerOf(b, a.sessionId)).toMatchObject({ name: aName, robeColor: '#2F6B5A' });
      expect(a.state.areaId).toBe('san-chua');
    });

    it('click để đi: server di chuyển nhân vật, người kia thấy vị trí mới', async () => {
      const start = { ...playerOf(a)! };
      const target = { x: start.x < 600 ? start.x + 120 : start.x - 120, y: start.y };
      a.send('move_to', target);
      await until(() => {
        const seen = playerOf(b, a.sessionId)!;
        return Math.abs(seen.x - target.x) <= 1 && !seen.moving;
      });
    });

    it('giữ phím hướng thì đi liên tục, thả phím thì dừng', async () => {
      const before = playerOf(a)!.y;
      a.send('dir', { x: 0, y: -1 });
      await until(() => playerOf(b, a.sessionId)!.y < before - 20);
      a.send('dir', { x: 0, y: 0 });
      await until(() => playerOf(b, a.sessionId)!.moving === false);
      const stopped = playerOf(b, a.sessionId)!.y;
      await sleep(250);
      expect(playerOf(b, a.sessionId)!.y).toBe(stopped);
    });

    it('bỏ qua tin nhắn sai định dạng, không làm hỏng state', async () => {
      const before = { ...playerOf(a)! };
      a.send('move_to', { x: 'abc', y: null });
      a.send('dir', { x: 5, y: 0 });
      a.send('donate', { amount: 7, dedication: 'x', showName: true });
      a.send('teleport', { x: 0, y: 0 });
      await sleep(250);
      expect(playerOf(b, a.sessionId)).toMatchObject({ x: before.x, y: before.y });
    });

    it('rớt mạng ngoài ý muốn: giữ chỗ và nối lại được bằng reconnection token', async () => {
      const token = b.reconnectionToken;
      const sessionId = b.sessionId;
      b.connection.close(3000); // 4000 là mã "chủ động rời" của Colyseus; mã khác = rớt mạng
      await sleep(200);
      expect(playerOf(a, sessionId)).toBeDefined();
      b = (await new Client(endpoint).reconnect<StateView>(token)) as TestRoom;
      expect(b.sessionId).toBe(sessionId);
    });

    it('rời room thì người kia không còn thấy', async () => {
      const id = b.sessionId;
      await b.leave();
      await until(() => !playerOf(a, id));
    });
  });
});

describe('khu vực', () => {
  it('ngoài Sân chùa chỉ thắp hương; lạy, cầu nguyện, công đức phải vào Chính điện', async () => {
    const r = await connect((await signUp()).token, 'san-chua');
    r.send('bow_start');
    expect((await nextMessage(r, 'action_error')).message).toMatch(/vào Chính điện để lạy/);
    expect(playerOf(r)?.action).toBe('');
    r.send('prayer', { text: 'Nguyện bình an' });
    expect((await nextMessage(r, 'action_error')).message).toMatch(/vào Chính điện để cầu nguyện/);
    r.send('donate', { amount: 10, dedication: 'Tất cả chúng sinh', showName: true });
    expect((await nextMessage(r, 'action_error')).message).toMatch(/Hòm công đức/);
    await leave(r);

    const inside = await connect((await signUp()).token, 'chinh-dien');
    inside.send('incense');
    expect((await nextMessage(inside, 'action_error')).message).toMatch(/ngoài Sân chùa/);
    await leave(inside);
  });

  it('bước lên hiên điện → được báo chuyển vào Chính điện, vào thì ngồi vào chỗ', async () => {
    const u = await signUp();
    const yard = await connect(u.token, 'san-chua');
    yard.send('move_to', { x: 450, y: 400 });
    expect(await nextMessage(yard, 'travel', undefined, 8000)).toEqual({ to: 'chinh-dien' });
    await leave(yard);

    const hall = await connect(u.token, 'chinh-dien', { from: 'san-chua' });
    await until(() => Boolean(playerOf(hall)));
    expect(playerOf(hall)).toMatchObject({ ...HALL_SEATS[0], action: 'kneeling' });
    await leave(hall);
  });

  it('tuỳ chọn "from" sai được bỏ qua (xuất hiện ngẫu nhiên)', async () => {
    const r = await connect((await signUp()).token, 'san-chua', { from: '<script>' });
    await until(() => Boolean(playerOf(r)));
    expect(playerOf(r)!.y).toBeGreaterThanOrEqual(600);
    await leave(r);
  });
});

describe('chuyển khu & bản sao', () => {
  async function travelFrom(area: string, x: number, y: number) {
    const r = await connect((await signUp()).token, area);
    r.send('move_to', { x, y });
    const msg = await nextMessage(r, 'travel', undefined, 10_000);
    await leave(r);
    return msg.to;
  }

  it('các lối đi nối đúng khu: cổng ↔ sân ↔ hồ sen / gác chuông', async () => {
    expect(await travelFrom('cong-tam-quan', 600, 420)).toBe('san-chua');
    expect(await travelFrom('san-chua', 40, 640)).toBe('ho-sen');
    expect(await travelFrom('san-chua', 1160, 640)).toBe('gac-chuong');
    expect(await travelFrom('san-chua', 600, 740)).toBe('cong-tam-quan');
    expect(await travelFrom('ho-sen', 1160, 640)).toBe('san-chua');
  }, 40_000);

  it('Chính điện đủ 40 người → người thứ 41 vào "Khu 2"; API đếm đủ người online', async () => {
    const { token } = await signUp();
    const rooms: TestRoom[] = [];
    for (let i = 0; i < HALL_SEATS.length; i++) rooms.push(await connect(token));
    const first = rooms[0]!;
    expect(new Set(rooms.map((r) => r.roomId)).size).toBe(1);
    await until(() => first.state.zone === 1);

    const extra = await connect(token);
    expect(extra.roomId).not.toBe(first.roomId);
    await until(() => extra.state.zone === 2);

    const online = await ctx.http().get('/api/online');
    expect(online.body.areas['chinh-dien']).toBe(HALL_SEATS.length + 1);
    expect(online.body.total).toBeGreaterThanOrEqual(HALL_SEATS.length + 1);

    // Khu 1 trống hẳn → đóng; room mới mở sau đó dùng lại số 1.
    await leave(...rooms);
    await sleep(300);
    const again = await connect((await signUp()).token);
    await until(() => again.state.zone === 1 || again.roomId === extra.roomId);
    await leave(extra, again);
  }, 60_000);
});

describe('phước & điểm danh', () => {
  it('lần đầu vào trong ngày được +20 phước, vào lại không được nữa', async () => {
    const u = await signUp();
    const r1 = await connect(u.token);
    expect((await nextMessage(r1, 'merit')).merit).toBe(120);
    expect((await nextMessage(r1, 'toast')).merit).toBe(20);
    await leave(r1);

    const r2 = await connect(u.token);
    expect((await nextMessage(r2, 'merit')).merit).toBe(120);
    await sleep(200);
    expect(r2.inbox.some((m) => m.type === 'toast')).toBe(false);
    await leave(r2);
  });
});

describe('thắp hương', () => {
  it('phải đứng gần lư hương', async () => {
    const r = await connect((await signUp()).token, 'san-chua');
    await walkTo(r, 150, 720); // góc xa lư hương
    r.send('incense');
    expect((await nextMessage(r, 'action_error')).message).toMatch(/gần lư hương/);
    await leave(r);
  });

  it('+5 phước, mọi người thấy hoạt động, hồi chiêu 60 giây; phước được ghi xuống DB', async () => {
    const u = await signUp();
    const r = await connect(u.token, 'san-chua');
    const watcher = await connect((await signUp()).token, 'san-chua');
    await nextMessage(r, 'merit');
    await walkTo(r, 600, 560);

    r.send('incense');
    expect((await nextMessage(r, 'merit')).merit).toBe(125);
    expect((await nextMessage(r, 'cooldown')).remainingMs).toBe(60_000);
    const seen = await nextMessage(watcher, 'activity', (a) => a.kind === 'incense');
    expect(seen).toMatchObject({ name: u.username, sessionId: r.sessionId, amount: 5 });

    r.send('incense');
    expect((await nextMessage(r, 'action_error')).message).toMatch(/chờ \d+ giây/);

    await services.merit.flush();
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.merit).toBe(125);
    await leave(r, watcher);
  });
});

describe('lạy Phật', () => {
  it('nhả nút sớm không tính lạy; đủ 3 lạy +3 phước; người khác thấy "đang lạy"', async () => {
    const r = await connect((await signUp()).token);
    const watcher = await connect((await signUp()).token);
    await nextMessage(r, 'merit');

    r.send('bow_start');
    await until(() => playerOf(watcher, r.sessionId)?.action === 'bowing');
    r.send('bow_complete'); // ngay lập tức → quá nhanh, bị bỏ qua
    await sleep(200);
    expect(r.inbox.some((m) => m.type === 'bow_progress')).toBe(false);

    for (let i = 1; i <= 3; i++) {
      r.send('bow_start');
      await until(() => playerOf(watcher, r.sessionId)?.action === 'bowing');
      await sleep(1050);
      r.send('bow_complete');
      expect((await nextMessage(r, 'bow_progress')).count).toBe(i);
      // Giữa các lạy: ngẩng lên, vẫn quỳ trên thảm.
      if (i < 3) await until(() => playerOf(watcher, r.sessionId)?.action === 'kneeling');
    }
    expect((await nextMessage(r, 'toast', (t) => t.text.includes('lạy'))).merit).toBe(3);
    expect((await nextMessage(r, 'merit', (m) => m.merit !== 120)).merit).toBe(123);
    // Đủ 3 lạy: ngẩng lên, vẫn ngồi trên thảm trong Chính điện.
    await until(() => playerOf(watcher, r.sessionId)?.action === 'kneeling');
    await nextMessage(watcher, 'activity', (a) => a.kind === 'bow');
    await leave(r, watcher);
  }, 15_000);

  it('nhả nút sớm hay đóng thẻ lạy thì ngẩng lên, vẫn ngồi trên thảm', async () => {
    const r = await connect((await signUp()).token);
    r.send('bow_start');
    await until(() => playerOf(r)?.action === 'bowing');
    r.send('bow_cancel');
    await until(() => playerOf(r)?.action === 'kneeling');
    r.send('bow_start');
    await until(() => playerOf(r)?.action === 'bowing');
    r.send('bow_end');
    await until(() => playerOf(r)?.action === 'kneeling');
    await leave(r);
  });
});

describe('chỗ ngồi trong Chính điện', () => {
  it('xếp chỗ gần tượng Phật trước, ngồi trên thảm ngay, không di chuyển được; rời đi thì nhường chỗ', async () => {
    const a = await connect((await signUp()).token);
    const b = await connect((await signUp()).token);
    await until(() => Boolean(playerOf(a) && playerOf(b)));
    expect(playerOf(a)).toMatchObject({ ...HALL_SEATS[0], action: 'kneeling' });
    expect(playerOf(b)).toMatchObject({ ...HALL_SEATS[1], action: 'kneeling' });

    a.send('move_to', { x: 600, y: 700 });
    a.send('dir', { x: 1, y: 0 });
    await sleep(300);
    expect(playerOf(b, a.sessionId)).toMatchObject({ ...HALL_SEATS[0], moving: false });

    await a.leave();
    const c = await connect((await signUp()).token);
    await until(() => Boolean(playerOf(c)));
    expect(playerOf(c)).toMatchObject(HALL_SEATS[0]!); // chỗ trống gần nhất
    await leave(b, c);
  });

  it('sức chứa mỗi Chính điện bằng số chỗ ngồi', async () => {
    const r = await connect((await signUp()).token);
    const [info] = await matchMaker.query({ roomId: r.roomId });
    expect(info!.maxClients).toBe(HALL_SEATS.length);
    await leave(r);
  });
});

describe('công đức', () => {
  it('trừ phước, ghi lịch sử, cập nhật bảng công đức; không đủ phước thì từ chối', async () => {
    const u = await signUp();
    const r = await connect(u.token);
    const watcher = await connect((await signUp()).token);
    await nextMessage(r, 'merit'); // 120

    r.send('donate', {
      amount: 100,
      dedication: 'Gia đình bình an',
      prayer: 'Nguyện cho cha mẹ luôn khoẻ mạnh.',
      showName: true,
    });
    expect((await nextMessage(r, 'merit')).merit).toBe(20);
    const act = await nextMessage(watcher, 'activity', (a) => a.kind === 'donation');
    expect(act).toMatchObject({
      name: u.username,
      amount: 100,
      text: 'Nguyện cho cha mẹ luôn khoẻ mạnh.',
    });
    const board = await nextMessage(watcher, 'leaderboard', (l) => l.length > 0);
    expect(board[0]).toEqual<LeaderboardEntry>({ rank: 1, name: u.username, score: 100 });

    r.send('donate', { amount: 50, dedication: 'Bản thân an lạc', showName: true });
    expect((await nextMessage(r, 'action_error')).message).toMatch(/Không đủ phước/);

    const rows = await ctx.prisma.donation.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 100, dedication: 'Gia đình bình an', showName: true });

    const api = await ctx.http().get('/api/leaderboard?period=day');
    expect(api.body.entries[0]).toMatchObject({ name: u.username, score: 100 });
    await leave(r, watcher);
  });

  it('ẩn tên: không lộ tên, không lên bảng công đức', async () => {
    const r = await connect((await signUp()).token);
    const watcher = await connect((await signUp()).token);
    await nextMessage(r, 'merit');
    const before = await services.leaderboard.top('day', 50);

    r.send('donate', { amount: 10, dedication: 'Tất cả chúng sinh', showName: false });
    const act = await nextMessage(watcher, 'activity', (a: ActivityItem) => a.kind === 'donation');
    expect(act.name).toBeNull();
    expect(act.sessionId).toBeUndefined();
    expect(await services.leaderboard.top('day', 50)).toEqual(before);
    await leave(r, watcher);
  });

  it('nhiều lệnh công đức đồng thời không làm âm số dư', async () => {
    const u = await signUp();
    const r = await connect(u.token);
    await nextMessage(r, 'merit'); // 120
    for (let i = 0; i < 5; i++) {
      r.send('donate', { amount: 50, dedication: 'Bản thân an lạc', showName: false });
    }
    await sleep(1000);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.merit).toBe(20); // chỉ 2 lần 50 thành công
    expect(await ctx.prisma.donation.count({ where: { userId: u.id } })).toBe(2);
    await leave(r);
  });
});

describe('lời nguyện & báo cáo', () => {
  it('lọc từ thô tục, giới hạn 1 tin/2 giây, ghi xuống DB theo lô; báo cáo được', async () => {
    const author = await signUp();
    const r = await connect(author.token);
    const other = await signUp();
    const watcher = await connect(other.token);

    r.send('prayer', { text: '  Nguyện bình an, đéo ai cản được  ' });
    const act = await nextMessage(watcher, 'activity', (a) => a.kind === 'prayer');
    expect(act.text).toBe('Nguyện bình an, *** ai cản được');
    expect(act.sessionId).toBe(r.sessionId);

    r.send('prayer', { text: 'gửi liền' });
    expect((await nextMessage(r, 'action_error')).message).toMatch(/hơi nhanh/);

    r.send('prayer', { text: 'a'.repeat(201) }); // quá dài → bỏ qua
    await services.prayers.flush();
    const saved = await ctx.prisma.prayer.findMany({ where: { userId: author.id } });
    expect(saved.map((p) => p.text)).toEqual(['Nguyện bình an, *** ai cản được']);

    r.send('report', { activityId: act.id });
    expect((await nextMessage(r, 'action_error')).message).toMatch(/chính mình/);
    watcher.send('report', { activityId: act.id });
    await nextMessage(watcher, 'toast');
    watcher.send('report', { activityId: act.id }); // báo cáo trùng vẫn êm
    await nextMessage(watcher, 'toast');
    const reports = await ctx.prisma.report.findMany();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reporterId: other.id, targetUserId: author.id });

    // Người vào sau nhận lại lịch sử hoạt động.
    const late = await connect((await signUp()).token);
    const history = await nextMessage(late, 'activity_history');
    expect(history.some((h) => h.id === act.id)).toBe(true);
    await leave(r, watcher, late);
  });
});

describe('thỉnh chuông', () => {
  it('chỉ thỉnh được ở Gác chuông, hồi chiêu 5 phút cho cả room', async () => {
    const r = await connect((await signUp()).token);
    r.send('bell');
    expect((await nextMessage(r, 'action_error')).message).toMatch(/Gác chuông/);
    await leave(r);

    const ringer = await connect((await signUp()).token, 'gac-chuong');
    const other = await connect((await signUp()).token, 'gac-chuong');
    ringer.send('bell');
    await nextMessage(other, 'activity', (a) => a.kind === 'bell');
    expect((await nextMessage(other, 'cooldown')).action).toBe('bell');

    other.send('bell');
    expect((await nextMessage(other, 'action_error')).message).toMatch(/vừa được thỉnh/);
    await leave(ringer, other);
  });
});
