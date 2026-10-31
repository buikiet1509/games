import { describe, expect, it } from 'vitest';
import { vnDateKey, vnIsoWeekKey, vnStartOfDay, vnStartOfWeek } from './time';

describe('giờ Việt Nam', () => {
  it('23h UTC đã là ngày hôm sau ở VN', () => {
    expect(vnDateKey(new Date('2026-10-31T16:59:00Z'))).toBe('2026-10-31');
    expect(vnDateKey(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11-01');
  });

  it('đầu ngày VN là 17h UTC hôm trước', () => {
    expect(vnStartOfDay(new Date('2026-11-01T03:00:00Z')).toISOString()).toBe(
      '2026-10-31T17:00:00.000Z',
    );
  });

  it('tuần bắt đầu từ thứ Hai, khoá tuần ISO đúng', () => {
    // 2026-10-31 là thứ Bảy → thứ Hai là 26/10.
    expect(vnStartOfWeek(new Date('2026-10-31T05:00:00Z')).toISOString()).toBe(
      '2026-10-25T17:00:00.000Z',
    );
    expect(vnIsoWeekKey(new Date('2026-10-31T05:00:00Z'))).toBe('2026-W44');
    expect(vnIsoWeekKey(new Date('2027-01-01T05:00:00Z'))).toBe('2026-W53');
    expect(vnIsoWeekKey(new Date('2026-01-01T05:00:00Z'))).toBe('2026-W01');
  });
});
