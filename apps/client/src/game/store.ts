import { signal } from '@preact/signals';
import type { ActivityItem, LeaderboardEntry, ServerMessages } from '@chua/shared';

export interface Toast {
  id: number;
  text: string;
  merit?: number;
  tone: 'success' | 'error';
}

/** Trạng thái màn chơi hiển thị ở lớp UI (Preact), nạp từ tin nhắn của room. */
export const merit = signal<number | null>(null);
export const toasts = signal<Toast[]>([]);
export const activity = signal<ActivityItem[]>([]);
export const leaderboard = signal<LeaderboardEntry[]>([]);
export const cooldownUntil = signal<{ incense: number; bell: number }>({ incense: 0, bell: 0 });
export const bowCount = signal(0);

const MAX_ACTIVITY = 50;
const TOAST_MS = 3500;
let toastSeq = 0;

export function showToast(text: string, opts: { merit?: number; tone?: Toast['tone'] } = {}) {
  const toast: Toast = { id: ++toastSeq, text, merit: opts.merit, tone: opts.tone ?? 'success' };
  toasts.value = [...toasts.value.slice(-2), toast];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== toast.id);
  }, TOAST_MS);
}

/** Phần tối thiểu của room mà store cần (để test dễ giả lập). */
export interface MessageSource {
  onMessage<K extends keyof ServerMessages>(
    type: K,
    cb: (data: ServerMessages[K]) => void,
  ): () => void;
}

/** Nối các tin nhắn server → store. Trả về hàm huỷ đăng ký. */
export function bindRoomToStore(room: MessageSource) {
  const offs = [
    room.onMessage('merit', ({ merit: m }) => {
      merit.value = m;
    }),
    room.onMessage('toast', ({ text, merit: m }) => showToast(text, { merit: m })),
    room.onMessage('action_error', ({ message }) => showToast(message, { tone: 'error' })),
    room.onMessage('cooldown', ({ action, remainingMs }) => {
      cooldownUntil.value = { ...cooldownUntil.value, [action]: Date.now() + remainingMs };
    }),
    room.onMessage('bow_progress', ({ count }) => {
      bowCount.value = count;
    }),
    room.onMessage('activity_history', (items) => {
      activity.value = items.slice(-MAX_ACTIVITY);
    }),
    room.onMessage('activity', (item) => {
      activity.value = [...activity.value, item].slice(-MAX_ACTIVITY);
    }),
    room.onMessage('leaderboard', (entries) => {
      leaderboard.value = entries;
    }),
  ];
  return () => offs.forEach((off) => off());
}

export function resetStore() {
  merit.value = null;
  toasts.value = [];
  activity.value = [];
  leaderboard.value = [];
  cooldownUntil.value = { incense: 0, bell: 0 };
  bowCount.value = 0;
}
