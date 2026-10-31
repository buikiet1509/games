// Ngày/tuần tính theo giờ Việt Nam (UTC+7) — "bảng công đức hôm nay" đổi ngày lúc 0h ở VN.
const VN_OFFSET_MS = 7 * 3600_000;

const shifted = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** YYYY-MM-DD theo giờ VN. */
export const vnDateKey = (d: Date) => shifted(d).toISOString().slice(0, 10);

/** Thời điểm 0h hôm nay (giờ VN) dưới dạng Date UTC. */
export function vnStartOfDay(d: Date) {
  const s = shifted(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - VN_OFFSET_MS);
}

/** 0h thứ Hai của tuần hiện tại (giờ VN). */
export function vnStartOfWeek(d: Date) {
  const day = vnStartOfDay(d);
  const weekday = (shifted(day).getUTCDay() + 6) % 7; // thứ Hai = 0
  return new Date(day.getTime() - weekday * 86400_000);
}

/** Khoá tuần ISO, vd. 2026-W44. */
export function vnIsoWeekKey(d: Date) {
  const s = shifted(d);
  const date = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3); // thứ Năm của tuần quyết định năm ISO
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
