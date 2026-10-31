import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessages } from '@chua/shared';
import {
  activity,
  bindRoomToStore,
  cooldownUntil,
  leaderboard,
  merit,
  resetStore,
  toasts,
  type MessageSource,
} from './store';

/** Room giả: cho phép test bắn tin nhắn server. */
function fakeRoom() {
  const handlers = new Map<string, (d: unknown) => void>();
  const room: MessageSource = {
    onMessage: (type, cb) => {
      handlers.set(type, cb as (d: unknown) => void);
      return () => handlers.delete(type);
    },
  };
  const emit = <K extends keyof ServerMessages>(type: K, data: ServerMessages[K]) =>
    handlers.get(type)?.(data);
  return { room, emit, handlers };
}

describe('store', () => {
  afterEach(() => {
    resetStore();
    vi.useRealTimers();
  });

  it('cập nhật phước, bảng công đức, hoạt động từ tin nhắn server', () => {
    const { room, emit } = fakeRoom();
    bindRoomToStore(room);
    emit('merit', { merit: 125 });
    emit('leaderboard', [{ rank: 1, name: 'dieu_hanh', score: 3400 }]);
    emit('activity_history', [{ id: '1', kind: 'incense', at: 1, name: 'a' }]);
    emit('activity', { id: '2', kind: 'bow', at: 2, name: 'b' });
    expect(merit.value).toBe(125);
    expect(leaderboard.value[0]!.name).toBe('dieu_hanh');
    expect(activity.value.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('toast tự biến mất; lỗi hiển thị dạng toast lỗi', () => {
    vi.useFakeTimers();
    const { room, emit } = fakeRoom();
    bindRoomToStore(room);
    emit('toast', { text: 'Bạn đã lạy Phật đủ 3 lạy', merit: 3 });
    emit('action_error', { action: 'incense', message: 'Hãy đến gần lư hương' });
    expect(toasts.value.map((t) => t.tone)).toEqual(['success', 'error']);
    vi.advanceTimersByTime(4000);
    expect(toasts.value).toEqual([]);
  });

  it('ghi nhận hồi chiêu theo thời gian còn lại', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { room, emit } = fakeRoom();
    bindRoomToStore(room);
    emit('cooldown', { action: 'incense', remainingMs: 60_000 });
    expect(cooldownUntil.value.incense).toBe(1_060_000);
  });

  it('huỷ đăng ký khi rời room', () => {
    const { room, handlers } = fakeRoom();
    const off = bindRoomToStore(room);
    expect(handlers.size).toBeGreaterThan(0);
    off();
    expect(handlers.size).toBe(0);
  });
});
