// Bản đồ từng khu và vật lý di chuyển dùng chung: server dùng để mô phỏng (nguồn sự thật),
// client dùng để vẽ cảnh khớp với va chạm.
import type { AreaId } from './constants';

/** Kích thước logic của cảnh (px). Client co giãn theo màn hình. */
export const WORLD = { width: 1200, height: 760 } as const;

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CircleObstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface AreaMap {
  /** Vùng đi lại được (toạ độ là vị trí chân nhân vật). */
  walk: Rect;
  obstacles: readonly CircleObstacle[];
  /** Vùng xuất hiện ngẫu nhiên khi vào khu (không từ khu khác sang). */
  spawn: Rect;
  /** Bước vào vùng này thì sang khu khác. */
  exits: readonly { to: AreaId; zone: Rect }[];
  /** Điểm đứng khi từ khu `from` đi sang. */
  entrances: Partial<Record<AreaId, Vec>>;
  /**
   * Khu ngồi cố định (Chính điện): mỗi người được xếp một chỗ theo thứ tự trong danh sách
   * (gần tượng Phật trước), ngồi trên thảm và không di chuyển. Số chỗ cũng là sức chứa của room.
   */
  seats?: readonly Vec[];
}

// Sơ đồ chùa:            Chính điện
//                            ↑ (hiên điện)
//          Hồ sen  ←    Sân chùa    →  Gác chuông
//                            ↓
//                      Cổng Tam Quan  (nơi bắt đầu)

/** Lối đi ở mép trái/phải/dưới cảnh (dải mỏng sát mép vùng đi lại). */
const LEFT_EDGE: Rect = { minX: 40, maxX: 52, minY: 560, maxY: 700 };
const RIGHT_EDGE: Rect = { minX: 1148, maxX: 1160, minY: 560, maxY: 700 };

/** Cổng Tam Quan: cổng lớn phía trên, lối đá dẫn vào. Đi qua cổng để vào Sân chùa. */
const CONG_TAM_QUAN: AreaMap = {
  walk: { minX: 40, maxX: 1160, minY: 420, maxY: 740 },
  obstacles: [
    { id: 'den-da-trai', x: 380, y: 480, r: 24 },
    { id: 'den-da-phai', x: 820, y: 480, r: 24 },
  ],
  spawn: { minX: 450, maxX: 750, minY: 640, maxY: 710 },
  exits: [{ to: 'san-chua', zone: { minX: 500, maxX: 700, minY: 420, maxY: 432 } }],
  entrances: { 'san-chua': { x: 600, y: 480 } },
};

/** Sân chùa: trước Chính điện, có lư hương và hai cây bồ đề. Ngã tư nối các khu. */
const SAN_CHUA: AreaMap = {
  walk: { minX: 40, maxX: 1160, minY: 400, maxY: 740 },
  obstacles: [
    { id: 'lu-huong', x: 600, y: 470, r: 72 },
    { id: 'cay-trai', x: 125, y: 560, r: 34 },
    { id: 'cay-phai', x: 1075, y: 540, r: 34 },
  ],
  spawn: { minX: 420, maxX: 780, minY: 620, maxY: 710 },
  exits: [
    { to: 'chinh-dien', zone: { minX: 380, maxX: 820, minY: 400, maxY: 412 } },
    { to: 'cong-tam-quan', zone: { minX: 480, maxX: 720, minY: 728, maxY: 740 } },
    { to: 'ho-sen', zone: LEFT_EDGE },
    { to: 'gac-chuong', zone: RIGHT_EDGE },
  ],
  entrances: {
    'chinh-dien': { x: 470, y: 440 },
    'cong-tam-quan': { x: 600, y: 700 },
    'ho-sen': { x: 90, y: 640 },
    'gac-chuong': { x: 1110, y: 640 },
  },
};

/** Hồ sen: hồ nước giữa cảnh (xấp xỉ bằng các vòng tròn), lối đi quanh hồ. */
const HO_SEN: AreaMap = {
  walk: { minX: 40, maxX: 1160, minY: 380, maxY: 740 },
  obstacles: [
    { id: 'ho-1', x: 380, y: 565, r: 95 },
    { id: 'ho-2', x: 520, y: 560, r: 110 },
    { id: 'ho-3', x: 680, y: 560, r: 110 },
    { id: 'ho-4', x: 820, y: 565, r: 95 },
  ],
  spawn: { minX: 960, maxX: 1100, minY: 600, maxY: 720 },
  exits: [{ to: 'san-chua', zone: RIGHT_EDGE }],
  entrances: { 'san-chua': { x: 1110, y: 640 } },
};

/** Gác chuông: lầu chuông với quả chuông đồng lớn. Thỉnh chuông ở đây. */
const GAC_CHUONG: AreaMap = {
  walk: { minX: 40, maxX: 1160, minY: 440, maxY: 740 },
  obstacles: [
    { id: 'cot-lau-trai', x: 455, y: 450, r: 18 },
    { id: 'cot-lau-phai', x: 745, y: 450, r: 18 },
  ],
  spawn: { minX: 120, maxX: 420, minY: 600, maxY: 720 },
  exits: [{ to: 'san-chua', zone: LEFT_EDGE }],
  entrances: { 'san-chua': { x: 90, y: 640 } },
};

/** Hàng ghế (y) từ gần bàn thờ ra xa, và các cột thảm hai bên lối đi giữa. */
const HALL_ROWS = [478, 538, 598, 658, 718];
const HALL_COLUMNS = [440, 760, 350, 850, 260, 940, 170, 1030]; // sát lối giữa trước

/** Chỗ ngồi trong Chính điện: hàng gần tượng Phật trước, trong hàng thì sát lối giữa trước. */
export const HALL_SEATS: readonly Vec[] = HALL_ROWS.flatMap((y) =>
  HALL_COLUMNS.map((x) => ({ x, y })),
);

/** Bên trong Chính điện: bàn thờ, tượng Phật ở trên; mọi người ngồi thảm theo chỗ được xếp. */
const CHINH_DIEN: AreaMap = {
  walk: { minX: 70, maxX: 1130, minY: 450, maxY: 740 },
  obstacles: [
    { id: 'cot-trai', x: 85, y: 560, r: 24 },
    { id: 'cot-phai', x: 1115, y: 560, r: 24 },
  ],
  spawn: { minX: 450, maxX: 750, minY: 600, maxY: 700 },
  exits: [],
  entrances: {},
  seats: HALL_SEATS,
};

export const AREA_MAPS: Record<AreaId, AreaMap> = {
  'cong-tam-quan': CONG_TAM_QUAN,
  'san-chua': SAN_CHUA,
  'chinh-dien': CHINH_DIEN,
  'ho-sen': HO_SEN,
  'gac-chuong': GAC_CHUONG,
};

/** Khu xuất hiện khi mới vào chùa. */
export const START_AREA: AreaId = 'cong-tam-quan';

export const mapFor = (areaId: AreaId | string): AreaMap => AREA_MAPS[areaId as AreaId] ?? SAN_CHUA;

/** Tốc độ đi bộ (px/giây). */
export const PLAYER_SPEED = 170;
/** Bán kính "thân" nhân vật khi va chạm. */
export const PLAYER_RADIUS = 14;

/** Ý định di chuyển: đi tới điểm đã click, hoặc giữ phím theo hướng (dir), hoặc đứng yên. */
export type MoveIntent =
  | { kind: 'idle' }
  | { kind: 'target'; x: number; y: number }
  | { kind: 'dir'; x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const inRect = (p: Vec, r: Rect) =>
  p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

export function clampToBounds(p: Vec, map: AreaMap): Vec {
  return {
    x: clamp(p.x, map.walk.minX, map.walk.maxX),
    y: clamp(p.y, map.walk.minY, map.walk.maxY),
  };
}

/** Đẩy điểm ra khỏi các vật cản và giữ trong vùng đi lại. */
export function resolveCollisions(p: Vec, map: AreaMap): Vec {
  let { x, y } = clampToBounds(p, map);
  for (const o of map.obstacles) {
    const dx = x - o.x;
    const dy = y - o.y;
    const min = o.r + PLAYER_RADIUS;
    const dist = Math.hypot(dx, dy);
    if (dist < min) {
      // Đứng đúng tâm vật cản (hiếm) → đẩy xuống phía người xem.
      const nx = dist === 0 ? 0 : dx / dist;
      const ny = dist === 0 ? 1 : dy / dist;
      x = o.x + nx * min;
      y = o.y + ny * min;
    }
  }
  return clampToBounds({ x, y }, map);
}

export interface StepResult {
  pos: Vec;
  /** Ý định sau bước này (đi tới nơi thì chuyển về idle). */
  intent: MoveIntent;
  moving: boolean;
}

/** Mô phỏng một bước di chuyển trong `dtSec` giây. */
export function stepMovement(
  pos: Vec,
  intent: MoveIntent,
  dtSec: number,
  map: AreaMap,
): StepResult {
  const maxDist = PLAYER_SPEED * dtSec;

  if (intent.kind === 'target') {
    const dx = intent.x - pos.x;
    const dy = intent.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxDist) {
      const next = resolveCollisions({ x: intent.x, y: intent.y }, map);
      return { pos: next, intent: { kind: 'idle' }, moving: dist > 0.01 };
    }
    const next = resolveCollisions(
      { x: pos.x + (dx / dist) * maxDist, y: pos.y + (dy / dist) * maxDist },
      map,
    );
    // Bị vật cản chặn hẳn (gần như không nhích) → dừng, tránh "cọ" mãi vào vật cản.
    if (Math.hypot(next.x - pos.x, next.y - pos.y) < maxDist * 0.05) {
      return { pos: next, intent: { kind: 'idle' }, moving: false };
    }
    return { pos: next, intent, moving: true };
  }

  if (intent.kind === 'dir') {
    const len = Math.hypot(intent.x, intent.y);
    if (len === 0) return { pos, intent: { kind: 'idle' }, moving: false };
    const next = resolveCollisions(
      { x: pos.x + (intent.x / len) * maxDist, y: pos.y + (intent.y / len) * maxDist },
      map,
    );
    return { pos: next, intent, moving: next.x !== pos.x || next.y !== pos.y };
  }

  return { pos, intent, moving: false };
}

/** Điểm xuất hiện ngẫu nhiên trong vùng spawn, không trùng vật cản. */
export function randomSpawn(map: AreaMap, random: () => number = Math.random): Vec {
  const s = map.spawn;
  return resolveCollisions(
    { x: s.minX + random() * (s.maxX - s.minX), y: s.minY + random() * (s.maxY - s.minY) },
    map,
  );
}

// ---------- Hành động theo khu ----------

export type ActionKind = 'incense' | 'bow' | 'donate' | 'prayer' | 'bell';

/** Hành động được phép ở từng khu: ngoài sân chỉ thắp hương; lạy, cầu nguyện, công đức trong điện. */
export const AREA_ACTIONS: Record<AreaId, readonly ActionKind[]> = {
  'cong-tam-quan': [],
  'san-chua': ['incense'],
  'chinh-dien': ['bow', 'donate', 'prayer'],
  'ho-sen': [],
  'gac-chuong': ['bell'],
};

/** Gợi ý khi làm hành động ở sai khu. */
export const ACTION_PLACE_HINT: Record<ActionKind, string> = {
  incense: 'Thắp hương ở lư hương ngoài Sân chùa',
  bow: 'Hãy vào Chính điện để lạy Phật',
  donate: 'Hòm công đức đặt trong Chính điện',
  prayer: 'Hãy vào Chính điện để cầu nguyện',
  bell: 'Chỉ có thể thỉnh chuông ở Gác chuông',
};

export const canDo = (areaId: string, action: ActionKind) =>
  (AREA_ACTIONS[areaId as AreaId] ?? []).includes(action);
