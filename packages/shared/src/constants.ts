export const AREAS = [
  { id: 'cong-tam-quan', name: 'Cổng Tam Quan' },
  { id: 'san-chua', name: 'Sân chùa' },
  { id: 'chinh-dien', name: 'Chính điện' },
  { id: 'ho-sen', name: 'Hồ sen' },
  { id: 'gac-chuong', name: 'Gác chuông' },
] as const;

export type AreaId = (typeof AREAS)[number]['id'];

export const ROOM_MAX_CLIENTS = 150;
export const TICK_RATE_HZ = 12;

/** Điểm phước — tiền ảo trong game, không quy đổi tiền thật. */
export const MERIT = {
  starting: 100,
  incense: 5,
  bow: 3,
  donationTiers: [10, 50, 100, 500],
} as const;

export const COOLDOWN_MS = {
  incense: 60_000,
  bellPerRoom: 5 * 60_000,
  prayer: 2_000,
} as const;

export const BOWS_REQUIRED = 3;
export const PRAYER_MAX_LENGTH = 200;

export const ROBE_COLORS = [
  '#8B1E1E',
  '#8A5A12',
  '#2F6B5A',
  '#4F6A9A',
  '#7A6A55',
  '#6B3B6B',
] as const;
