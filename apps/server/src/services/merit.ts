import type { Prisma, PrismaClient } from '@prisma/client';
import { MERIT } from '@chua/shared';
import { vnDateKey } from './time';

type Tx = Prisma.TransactionClient;

/**
 * Sổ phước. Phước *nhận* (thắp hương, lạy) được cộng dồn trong bộ nhớ rồi ghi xuống
 * Postgres theo lô; phước *chi* (công đức) ghi ngay trong transaction có kiểm tra số dư.
 */
export function createMeritLedger(prisma: PrismaClient, onError: (err: unknown) => void) {
  const pending = new Map<string, number>();
  let timer: NodeJS.Timeout | undefined;

  async function write(entries: [string, number][]) {
    if (entries.length === 0) return;
    const ids = entries.map(([id]) => id);
    const deltas = entries.map(([, d]) => d);
    await prisma.$executeRaw`
      UPDATE "User" AS u SET merit = u.merit + v.delta
      FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${deltas}::int[]) AS delta) AS v
      WHERE u.id = v.id`;
  }

  async function flushEntries(entries: [string, number][]) {
    try {
      await write(entries);
    } catch (err) {
      for (const [id, d] of entries) pending.set(id, (pending.get(id) ?? 0) + d);
      throw err;
    }
  }

  const ledger = {
    credit(userId: string, amount: number) {
      pending.set(userId, (pending.get(userId) ?? 0) + amount);
    },

    async flush() {
      const entries = [...pending];
      pending.clear();
      await flushEntries(entries);
    },

    async flushUser(userId: string) {
      const delta = pending.get(userId);
      if (!delta) return;
      pending.delete(userId);
      await flushEntries([[userId, delta]]);
    },

    /** Số dư thật = trong DB + phần chưa ghi. */
    async balance(userId: string) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { merit: true } });
      return (user?.merit ?? 0) + (pending.get(userId) ?? 0);
    },

    /**
     * Trừ phước nguyên tử (không bao giờ âm) và chạy `then` trong cùng transaction.
     * Trả về số dư mới, hoặc null nếu không đủ phước.
     */
    async spend(userId: string, amount: number, then: (tx: Tx) => Promise<unknown>) {
      await ledger.flushUser(userId);
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({
          where: { id: userId, merit: { gte: amount } },
          data: { merit: { decrement: amount } },
        });
        if (count === 0) return null;
        await then(tx);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { merit: true },
        });
        return user.merit;
      });
    },

    /** Điểm danh hằng ngày (nguyên tử, nhiều tab cùng lúc cũng chỉ nhận một lần). */
    async checkIn(userId: string, now = new Date()): Promise<boolean> {
      const today = vnDateKey(now);
      const updated = await prisma.$executeRaw`
        UPDATE "User" SET merit = merit + ${MERIT.dailyCheckIn}, "lastCheckIn" = ${today}
        WHERE id = ${userId}::uuid AND "lastCheckIn" IS DISTINCT FROM ${today}`;
      return updated > 0;
    },

    start(intervalMs = 5000) {
      timer ??= setInterval(() => ledger.flush().catch(onError), intervalMs);
      timer.unref();
    },

    async stop() {
      clearInterval(timer);
      timer = undefined;
      await ledger.flush();
    },
  };
  return ledger;
}

export type MeritLedger = ReturnType<typeof createMeritLedger>;
