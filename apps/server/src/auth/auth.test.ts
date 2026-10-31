import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cookieHeader,
  createTestContext,
  refreshCookieOf,
  validUser,
  type TestContext,
} from '../../test/helpers';
import { MAX_FAILED_LOGINS } from './lockout';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const register = (body: Partial<typeof validUser> = {}) =>
  ctx
    .http()
    .post('/api/auth/register')
    .send({ ...validUser, ...body });

const login = (identifier: string, password: string, remember?: boolean) =>
  ctx.http().post('/api/auth/login').send({ identifier, password, remember });

describe('POST /api/auth/register', () => {
  it('tạo tài khoản, trả access token và đặt refresh cookie an toàn', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      username: 'minh_tam',
      email: 'minhtam@example.com', // email được chuẩn hoá chữ thường
      merit: 100,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = refreshCookieOf(res)!;
    expect(cookie.line).toMatch(/HttpOnly/);
    expect(cookie.line).toMatch(/Secure/);
    expect(cookie.line).toMatch(/SameSite=Strict/);
    expect(cookie.line).toMatch(/Path=\/api\/auth/);
  });

  it('lưu mật khẩu dạng argon2id, không lưu thô', async () => {
    await register();
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { username: 'minh_tam' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(validUser.password);
  });

  it('từ chối username hoặc email trùng', async () => {
    await register();
    expect((await register({ email: 'khac@example.com' })).status).toBe(409);
    expect((await register({ username: 'nguoi_khac' })).status).toBe(409);
  });

  it.each<[Partial<typeof validUser>, string]>([
    [{ username: 'AB' }, 'username sai định dạng'],
    [{ email: 'khong-phai-email' }, 'email sai'],
    [{ password: 'ngan' }, 'mật khẩu ngắn'],
    [{ password: 'password123' }, 'mật khẩu phổ biến'],
    [{ password: 'minh_tam_2026!' }, 'mật khẩu chứa username'],
    [{ robeColor: '#000000' }, 'màu áo không có trong danh sách'],
  ])('trả 400 khi %o (%s)', async (patch) => {
    const res = await register(patch);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('đăng nhập bằng username hoặc email (không phân biệt hoa thường)', async () => {
    expect((await login('minh_tam', validUser.password)).status).toBe(200);
    expect((await login('MINHTAM@example.com', validUser.password)).status).toBe(200);
  });

  it('thông báo lỗi chung chung cho sai mật khẩu và tài khoản không tồn tại', async () => {
    const wrongPass = await login('minh_tam', 'sai-mat-khau-roi');
    const noUser = await login('khong_ton_tai', 'sai-mat-khau-roi');
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.error).toBe('Sai tên đăng nhập hoặc mật khẩu');
    expect(noUser.body.error).toBe(wrongPass.body.error);
  });

  it(`khoá tạm 15 phút sau ${MAX_FAILED_LOGINS} lần sai, kể cả khi sau đó nhập đúng`, async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      expect((await login('minh_tam', 'sai-mat-khau-roi')).status).toBe(401);
    }
    const locked = await login('minh_tam', validUser.password);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/15 phút/);
    // Đổi sang email cũng không lách được vì khoá theo tài khoản.
    expect((await login('minhtam@example.com', validUser.password)).status).toBe(429);
  });

  it('đăng nhập đúng sẽ reset bộ đếm sai', async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) await login('minh_tam', 'sai-mat-khau-roi');
    expect((await login('minh_tam', validUser.password)).status).toBe(200);
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) await login('minh_tam', 'sai-mat-khau-roi');
    expect((await login('minh_tam', validUser.password)).status).toBe(200);
  });

  it('rate limit theo IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await login(`nguoi_${i}`, 'sai-mat-khau-roi')).status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('"Ghi nhớ đăng nhập" → cookie bền; không ghi nhớ → cookie phiên', async () => {
    const remembered = refreshCookieOf(await login('minh_tam', validUser.password, true))!;
    const session = refreshCookieOf(await login('minh_tam', validUser.password, false))!;
    expect(remembered.line).toMatch(/Expires=/);
    expect(session.line).not.toMatch(/Expires=|Max-Age=/);
  });
});

describe('refresh token xoay vòng', () => {
  it('đổi refresh token lấy access token mới và token mới', async () => {
    const first = refreshCookieOf(await register())!.value;
    const res = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(first));
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const second = refreshCookieOf(res)!.value;
    expect(second).not.toBe(first);
  });

  it('lưu refresh token dạng hash trong DB', async () => {
    const token = refreshCookieOf(await register())!.value;
    const rows = await ctx.prisma.refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(token);
  });

  it('dùng lại token cũ sau khoảng ân hạn → thu hồi cả chuỗi phiên', async () => {
    const first = refreshCookieOf(await register())!.value;
    const rotated = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(first));
    const second = refreshCookieOf(rotated)!.value;

    // Giả lập token cũ bị thu hồi từ lâu (quá khoảng ân hạn 10 giây).
    await ctx.prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const reuse = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(first));
    expect(reuse.status).toBe(401);
    // Token hợp lệ mới nhất cũng bị huỷ theo.
    const after = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(second));
    expect(after.status).toBe(401);
  });

  it('hai tab refresh gần như cùng lúc bằng một cookie đều thành công', async () => {
    const token = refreshCookieOf(await register())!.value;
    const [a, b] = await Promise.all([
      ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(token)),
      ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(token)),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
  });

  it('thiếu cookie hoặc cookie rác → 401', async () => {
    expect((await ctx.http().post('/api/auth/refresh')).status).toBe(401);
    const res = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader('rac'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('thu hồi refresh token và xoá cookie', async () => {
    const token = refreshCookieOf(await register())!.value;
    const res = await ctx.http().post('/api/auth/logout').set('Cookie', cookieHeader(token));
    expect(res.status).toBe(204);
    expect(refreshCookieOf(res)!.line).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(token));
    expect(after.status).toBe(401);
  });
});

describe('GET /api/me', () => {
  it('cần access token hợp lệ', async () => {
    const { accessToken } = (await register()).body;
    const ok = await ctx.http().get('/api/me').set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.user.username).toBe('minh_tam');

    expect((await ctx.http().get('/api/me')).status).toBe(401);
    const bad = await ctx.http().get('/api/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(bad.status).toBe(401);
  });
});

describe('quên mật khẩu', () => {
  const resetTokenFromMail = () => {
    const text = ctx.mailer.sent.at(-1)!.text;
    return new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
  };

  it('trả lời giống nhau dù email có tồn tại hay không', async () => {
    await register();
    const known = await ctx.http().post('/api/auth/forgot').send({ email: validUser.email });
    const unknown = await ctx.http().post('/api/auth/forgot').send({ email: 'ai@example.com' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  it('đặt lại mật khẩu bằng token một lần và đăng xuất mọi thiết bị', async () => {
    const oldRefresh = refreshCookieOf(await register())!.value;
    await ctx.http().post('/api/auth/forgot').send({ email: validUser.email });
    const token = resetTokenFromMail();

    const newPassword = 'hoa-sen-tren-ho-moi';
    const res = await ctx.http().post('/api/auth/reset').send({ token, password: newPassword });
    expect(res.status).toBe(204);

    expect((await login('minh_tam', validUser.password)).status).toBe(401);
    expect((await login('minh_tam', newPassword)).status).toBe(200);
    const old = await ctx.http().post('/api/auth/refresh').set('Cookie', cookieHeader(oldRefresh));
    expect(old.status).toBe(401);

    // Dùng lại token lần hai → bị từ chối.
    const again = await ctx
      .http()
      .post('/api/auth/reset')
      .send({ token, password: 'mat-khau-khac-nua' });
    expect(again.status).toBe(400);
  });

  it('token hết hạn sau 30 phút', async () => {
    await register();
    await ctx.http().post('/api/auth/forgot').send({ email: validUser.email });
    await ctx.prisma.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await ctx
      .http()
      .post('/api/auth/reset')
      .send({ token: resetTokenFromMail(), password: 'hoa-sen-tren-ho-moi' });
    expect(res.status).toBe(400);
  });

  it('token mới làm vô hiệu token cũ chưa dùng', async () => {
    await register();
    await ctx.http().post('/api/auth/forgot').send({ email: validUser.email });
    const first = resetTokenFromMail();
    await ctx.http().post('/api/auth/forgot').send({ email: validUser.email });
    const res = await ctx
      .http()
      .post('/api/auth/reset')
      .send({ token: first, password: 'hoa-sen-tren-ho-moi' });
    expect(res.status).toBe(400);
  });
});
