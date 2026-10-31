import { z } from 'zod';
import { AREAS, DEDICATIONS, MERIT, PRAYER_MAX_LENGTH, type AreaId } from './constants';

const coord = z.number().finite();
const empty = z.object({}).strict().or(z.undefined()).or(z.null());

/** Tin nhắn client → server trong room. Server luôn validate trước khi dùng. */
export const clientMessageSchemas = {
  move_to: z.object({ x: coord, y: coord }),
  dir: z.object({ x: z.number().int().min(-1).max(1), y: z.number().int().min(-1).max(1) }),
  incense: empty,
  bow_start: empty,
  bow_complete: empty,
  bow_cancel: empty,
  bow_end: empty,
  bell: empty,
  donate: z.object({
    amount: z.union([
      z.literal(MERIT.donationTiers[0]),
      z.literal(MERIT.donationTiers[1]),
      z.literal(MERIT.donationTiers[2]),
      z.literal(MERIT.donationTiers[3]),
    ]),
    dedication: z.enum(DEDICATIONS),
    prayer: z.string().trim().max(PRAYER_MAX_LENGTH).optional(),
    showName: z.boolean(),
  }),
  prayer: z.object({ text: z.string().trim().min(1).max(PRAYER_MAX_LENGTH) }),
  report: z.object({ activityId: z.string().min(1).max(64) }),
} as const;

export type ClientMessageType = keyof typeof clientMessageSchemas;
export type ClientMessage<T extends ClientMessageType> = z.infer<(typeof clientMessageSchemas)[T]>;

/** Tuỳ chọn khi vào room: đến từ khu nào (để xuất hiện ở đúng lối vào). */
export const joinOptionsSchema = z
  .object({ from: z.enum(AREAS.map((a) => a.id) as [AreaId, ...AreaId[]]).optional() })
  .catch({});

// ---------- Server → client ----------

export type ActivityKind = 'incense' | 'bow' | 'donation' | 'prayer' | 'bell';

/** Một dòng trong luồng "Hoạt động & lời nguyện". `name` null = ẩn danh. */
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: number;
  name: string | null;
  /** sessionId của người thực hiện trong room (để vẽ hiệu ứng trên đầu). */
  sessionId?: string;
  amount?: number;
  text?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
}

export type LeaderboardPeriod = 'day' | 'week' | 'all';

/** Các tin nhắn riêng server gửi cho một client. */
export interface ServerMessages {
  /** Số dư phước hiện tại của mình. */
  merit: { merit: number };
  toast: { text: string; merit?: number };
  action_error: { action: ClientMessageType; message: string };
  cooldown: { action: 'incense' | 'bell'; remainingMs: number };
  bow_progress: { count: number };
  /** Bước vào lối đi sang khu khác → client rời room hiện tại và vào khu `to`. */
  travel: { to: AreaId };
  activity: ActivityItem;
  activity_history: ActivityItem[];
  leaderboard: LeaderboardEntry[];
}
