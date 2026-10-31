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
  dailyCheckIn: 20,
  donationTiers: [10, 50, 100, 500],
} as const;

export type DonationTier = (typeof MERIT.donationTiers)[number];

export const DEDICATIONS = [
  'Gia đình bình an',
  'Cha mẹ khoẻ mạnh',
  'Hương linh người đã khuất',
  'Bản thân an lạc',
  'Tất cả chúng sinh',
] as const;

/** Thời gian nhấn giữ cho mỗi lạy. */
export const BOW_HOLD_MS = 1200;
/** Khoảng cách tối đa từ tâm lư hương để thắp hương được. */
export const INCENSE_RANGE = 150;

export const COOLDOWN_MS = {
  incense: 60_000,
  /** Lạy thì lúc nào cũng được, nhưng chỉ nhận phước tối đa một lần mỗi khoảng này. */
  bowReward: 60_000,
  bellPerRoom: 5 * 60_000,
  prayer: 2_000,
} as const;

/** Thời gian bong bóng lời nguyện hiện trên đầu nhân vật. */
export const PRAYER_BUBBLE_MS = 5_000;

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
