import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../../test/helpers';
import { createLeaderboard } from './leaderboard';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const NOW = new Date('2026-10-31T05:00:00Z'); // thứ Bảy, 12h trưa giờ VN

async function user(username: string) {
  return ctx.prisma.user.create({
    data: { username, email: `${username}@x.vn`, passwordHash: 'x', robeColor: '#8B1E1E' },
  });
}

describe('bảng công đức', () => {
  it('cộng dồn theo ngày/tuần/tất cả và trả về top kèm tên', async () => {
    const lb = createLeaderboard(ctx.redis);
    await lb.add('u1', 'dieu_hanh', 500, NOW);
    await lb.add('u2', 'minh_tam', 100, NOW);
    await lb.add('u1', 'dieu_hanh', 100, NOW);
    expect(await lb.top('day', 3, NOW)).toEqual([
      { rank: 1, name: 'dieu_hanh', score: 600 },
      { rank: 2, name: 'minh_tam', score: 100 },
    ]);
    // Ngày hôm sau bảng "hôm nay" trống, bảng tuần vẫn giữ.
    const tomorrow = new Date(NOW.getTime() + 86400_000);
    expect(await lb.top('day', 3, tomorrow)).toEqual([]);
    expect((await lb.top('week', 3, tomorrow))[0]!.score).toBe(600);
  });

  it('Redis mất dữ liệu → dựng lại từ lịch sử công đức trong Postgres (bỏ qua công đức ẩn danh)', async () => {
    const a = await user('dieu_hanh');
    const b = await user('minh_tam');
    const at = (iso: string) => new Date(iso);
    await ctx.prisma.donation.createMany({
      data: [
        {
          userId: a.id,
          amount: 500,
          dedication: 'x',
          showName: true,
          areaId: 'chinh-dien',
          createdAt: NOW,
        },
        // Thứ Hai đầu tuần (cùng tuần, khác ngày)
        {
          userId: b.id,
          amount: 100,
          dedication: 'x',
          showName: true,
          areaId: 'chinh-dien',
          createdAt: at('2026-10-26T02:00:00Z'),
        },
        // Tuần trước
        {
          userId: b.id,
          amount: 500,
          dedication: 'x',
          showName: true,
          areaId: 'chinh-dien',
          createdAt: at('2026-10-20T02:00:00Z'),
        },
        // Ẩn danh
        {
          userId: b.id,
          amount: 500,
          dedication: 'x',
          showName: false,
          areaId: 'chinh-dien',
          createdAt: NOW,
        },
      ],
    });

    const lb = createLeaderboard(ctx.redis);
    expect(await lb.rebuildIfEmpty(ctx.prisma, NOW)).toBe(true);
    expect(await lb.top('day', 5, NOW)).toEqual([{ rank: 1, name: 'dieu_hanh', score: 500 }]);
    expect(await lb.top('week', 5, NOW)).toEqual([
      { rank: 1, name: 'dieu_hanh', score: 500 },
      { rank: 2, name: 'minh_tam', score: 100 },
    ]);
    expect(await lb.top('all', 5, NOW)).toEqual([
      { rank: 1, name: 'minh_tam', score: 600 },
      { rank: 2, name: 'dieu_hanh', score: 500 },
    ]);
    // Đã có dữ liệu → không dựng lại lần nữa.
    expect(await lb.rebuildIfEmpty(ctx.prisma, NOW)).toBe(false);
  });
});
