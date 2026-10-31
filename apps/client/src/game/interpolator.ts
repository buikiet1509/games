interface Snapshot {
  t: number;
  x: number;
  y: number;
}

/**
 * Nội suy snapshot: vẽ nhân vật ở thời điểm "hiện tại − delay" giữa hai bản cập nhật
 * từ server, nên chuyển động mượt dù server chỉ gửi ~12 lần/giây.
 */
export class Interpolator {
  private buffer: Snapshot[] = [];

  constructor(private delayMs = 120) {}

  push(t: number, x: number, y: number) {
    this.buffer.push({ t, x, y });
    if (this.buffer.length > 20) this.buffer.shift();
  }

  /** Đặt thẳng vị trí (vd. lúc mới xuất hiện) — bỏ lịch sử cũ. */
  reset(t: number, x: number, y: number) {
    this.buffer = [{ t, x, y }];
  }

  sample(now: number): { x: number; y: number } {
    const buf = this.buffer;
    if (buf.length === 0) return { x: 0, y: 0 };
    const renderAt = now - this.delayMs;
    const first = buf[0]!;
    if (renderAt <= first.t) return { x: first.x, y: first.y };
    for (let i = buf.length - 1; i > 0; i--) {
      const a = buf[i - 1]!;
      const b = buf[i]!;
      if (renderAt >= a.t) {
        if (renderAt >= b.t) return { x: b.x, y: b.y };
        const k = (renderAt - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: first.x, y: first.y };
  }
}
