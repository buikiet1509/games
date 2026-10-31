import { describe, expect, it } from 'vitest';
import {
  OBSTACLES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WALK_BOUNDS,
  randomSpawn,
  resolveCollisions,
  stepMovement,
} from './world';

const insideObstacle = (p: { x: number; y: number }) =>
  OBSTACLES.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r + PLAYER_RADIUS - 0.001);

describe('stepMovement', () => {
  it('đi tới điểm đích với tốc độ giới hạn', () => {
    const r = stepMovement({ x: 300, y: 650 }, { kind: 'target', x: 900, y: 650 }, 1);
    expect(r.pos.x).toBeCloseTo(300 + PLAYER_SPEED);
    expect(r.moving).toBe(true);
    expect(r.intent.kind).toBe('target');
  });

  it('tới nơi thì dừng và chuyển về idle', () => {
    const r = stepMovement({ x: 300, y: 650 }, { kind: 'target', x: 310, y: 650 }, 1);
    expect(r.pos).toEqual({ x: 310, y: 650 });
    expect(r.intent).toEqual({ kind: 'idle' });
  });

  it('di chuyển theo hướng phím, đi chéo không nhanh hơn đi thẳng', () => {
    const r = stepMovement({ x: 300, y: 650 }, { kind: 'dir', x: 1, y: -1 }, 0.1);
    const moved = Math.hypot(r.pos.x - 300, r.pos.y - 650);
    expect(moved).toBeCloseTo(PLAYER_SPEED * 0.1);
  });

  it('không đi ra ngoài sân', () => {
    let pos = { x: 100, y: 450 };
    for (let i = 0; i < 100; i++) pos = stepMovement(pos, { kind: 'dir', x: -1, y: -1 }, 0.1).pos;
    expect(pos).toEqual({ x: WALK_BOUNDS.minX, y: WALK_BOUNDS.minY });
  });

  it('không đi xuyên lư hương', () => {
    const censer = OBSTACLES.find((o) => o.id === 'lu-huong')!;
    let r = stepMovement(
      { x: censer.x, y: censer.y + 200 },
      { kind: 'target', x: censer.x, y: censer.y },
      0.1,
    );
    for (let i = 0; i < 50 && r.intent.kind !== 'idle'; i++) {
      expect(insideObstacle(r.pos)).toBe(false);
      r = stepMovement(r.pos, r.intent, 0.1);
    }
    expect(insideObstacle(r.pos)).toBe(false);
    expect(r.intent.kind).toBe('idle'); // bị chặn thì dừng, không cọ mãi
  });
});

describe('resolveCollisions / randomSpawn', () => {
  it('đẩy điểm nằm trong vật cản ra ngoài', () => {
    for (const o of OBSTACLES) expect(insideObstacle(resolveCollisions(o))).toBe(false);
  });

  it('điểm xuất hiện luôn hợp lệ', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const p = randomSpawn(rand);
      expect(insideObstacle(p)).toBe(false);
      expect(p.y).toBeGreaterThanOrEqual(WALK_BOUNDS.minY);
    }
  });
});
