import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { randomToken, sha256 } from '../lib/crypto';

export const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 3600_000;
export const REFRESH_TTL_SESSION_MS = 12 * 3600_000;
// Nhiều tab cùng refresh gần như đồng thời bằng một cookie là chuyện bình thường;
// trong khoảng này, token vừa bị xoay không bị coi là bị đánh cắp.
const REUSE_GRACE_MS = 10_000;

export interface IssuedRefresh {
  token: string;
  userId: string;
  remember: boolean;
  expiresAt: Date;
}

export function createRefreshTokens(prisma: PrismaClient) {
  function newToken(userId: string, remember: boolean, familyId: string) {
    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + (remember ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_SESSION_MS),
    );
    const data = { userId, tokenHash: sha256(token), familyId, remember, expiresAt };
    return { data, issued: { token, userId, remember, expiresAt } satisfies IssuedRefresh };
  }

  async function issue(userId: string, remember: boolean, familyId: string = randomUUID()) {
    const { data, issued } = newToken(userId, remember, familyId);
    await prisma.refreshToken.create({ data });
    return issued;
  }

  async function revokeFamily(familyId: string) {
    await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async function hasActiveToken(familyId: string) {
    const active = await prisma.refreshToken.count({
      where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return active > 0;
  }

  /** Đổi refresh token cũ lấy token mới. Trả về null nếu token không còn dùng được. */
  async function rotate(token: string): Promise<IssuedRefresh | null> {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.expiresAt <= new Date()) return null;

    if (row.revokedAt) {
      // Ân hạn chỉ khi token bị *xoay* (chuỗi còn token kế nhiệm đang sống),
      // không áp dụng khi bị thu hồi do đăng xuất / đặt lại mật khẩu / phát hiện dùng lại.
      const withinGrace = Date.now() - row.revokedAt.getTime() <= REUSE_GRACE_MS;
      if (withinGrace && (await hasActiveToken(row.familyId))) {
        return issue(row.userId, row.remember, row.familyId);
      }
      // Token đã thu hồi bị dùng lại → nhiều khả năng bị lộ: huỷ cả chuỗi phiên.
      await revokeFamily(row.familyId);
      return null;
    }

    // Thu hồi token cũ và tạo token mới trong cùng transaction, để tab khác không bao giờ
    // thấy trạng thái "cũ đã thu hồi mà chưa có token mới" (sẽ bị hiểu nhầm là dùng lại).
    const { data, issued } = newToken(row.userId, row.remember, row.familyId);
    const rotated = await prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({ data });
      return true;
    });
    return rotated ? issued : rotate(token); // tab khác vừa xoay xong → đi nhánh ân hạn
  }

  async function revoke(token: string) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (row) await revokeFamily(row.familyId);
  }

  async function revokeAllForUser(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return { issue, rotate, revoke, revokeAllForUser };
}

export type RefreshTokens = ReturnType<typeof createRefreshTokens>;
