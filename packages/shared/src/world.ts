// Bản đồ và vật lý di chuyển dùng chung: server dùng để mô phỏng (nguồn sự thật),
// client dùng để vẽ cảnh khớp với va chạm.

/** Kích thước logic của cảnh (px). Client co giãn theo màn hình. */
export const WORLD = { width: 1200, height: 760 } as const;

/** Vùng sân đi lại được (toạ độ là vị trí chân nhân vật). */
export const WALK_BOUNDS = { minX: 40, maxX: 1160, minY: 400, maxY: 740 } as const;

export interface CircleObstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

export const OBSTACLES: readonly CircleObstacle[] = [
  { id: 'lu-huong', x: 600, y: 470, r: 72 },
  { id: 'cay-trai', x: 125, y: 560, r: 34 },
  { id: 'cay-phai', x: 1075, y: 540, r: 34 },
];

/** Tốc độ đi bộ (px/giây). */
export const PLAYER_SPEED = 170;
/** Bán kính "thân" nhân vật khi va chạm. */
export const PLAYER_RADIUS = 14;

export interface Vec {
  x: number;
  y: number;
}

/** Ý định di chuyển: đi tới điểm đã click, hoặc giữ phím theo hướng (dir), hoặc đứng yên. */
export type MoveIntent =
  | { kind: 'idle' }
  | { kind: 'target'; x: number; y: number }
  | { kind: 'dir'; x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampToBounds(p: Vec): Vec {
  return {
    x: clamp(p.x, WALK_BOUNDS.minX, WALK_BOUNDS.maxX),
    y: clamp(p.y, WALK_BOUNDS.minY, WALK_BOUNDS.maxY),
  };
}

/** Đẩy điểm ra khỏi các vật cản và giữ trong sân. */
export function resolveCollisions(p: Vec): Vec {
  let { x, y } = clampToBounds(p);
  for (const o of OBSTACLES) {
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
  return clampToBounds({ x, y });
}

export interface StepResult {
  pos: Vec;
  /** Ý định sau bước này (đi tới nơi thì chuyển về idle). */
  intent: MoveIntent;
  moving: boolean;
}

/** Mô phỏng một bước di chuyển trong `dtSec` giây. */
export function stepMovement(pos: Vec, intent: MoveIntent, dtSec: number): StepResult {
  const maxDist = PLAYER_SPEED * dtSec;

  if (intent.kind === 'target') {
    const dx = intent.x - pos.x;
    const dy = intent.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxDist) {
      const next = resolveCollisions({ x: intent.x, y: intent.y });
      return { pos: next, intent: { kind: 'idle' }, moving: dist > 0.01 };
    }
    const next = resolveCollisions({
      x: pos.x + (dx / dist) * maxDist,
      y: pos.y + (dy / dist) * maxDist,
    });
    // Bị vật cản chặn hẳn (gần như không nhích) → dừng, tránh "cọ" mãi vào vật cản.
    if (Math.hypot(next.x - pos.x, next.y - pos.y) < maxDist * 0.05) {
      return { pos: next, intent: { kind: 'idle' }, moving: false };
    }
    return { pos: next, intent, moving: true };
  }

  if (intent.kind === 'dir') {
    const len = Math.hypot(intent.x, intent.y);
    if (len === 0) return { pos, intent: { kind: 'idle' }, moving: false };
    const next = resolveCollisions({
      x: pos.x + (intent.x / len) * maxDist,
      y: pos.y + (intent.y / len) * maxDist,
    });
    return { pos: next, intent, moving: next.x !== pos.x || next.y !== pos.y };
  }

  return { pos, intent, moving: false };
}

/** Điểm xuất hiện ngẫu nhiên ở nửa dưới sân, không trùng vật cản. */
export function randomSpawn(random: () => number = Math.random): Vec {
  return resolveCollisions({ x: 420 + random() * 360, y: 620 + random() * 90 });
}
