import { describe, expect, it } from 'vitest';
import {
  AREA_MAPS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  canDo,
  exitAt,
  inRect,
  mapFor,
  randomSpawn,
  resolveCollisions,
  stepMovement as step,
  type MoveIntent,
  type Vec,
} from './world';

const MAP = mapFor('san-chua');
const OBSTACLES = MAP.obstacles;
const WALK_BOUNDS = MAP.walk;
const stepMovement = (p: Vec, i: MoveIntent, dt: number) => step(p, i, dt, MAP);
const insideObstacle = (p: Vec, map = MAP) =>
  map.obstacles.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.r + PLAYER_RADIUS - 0.001);

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
    for (const o of OBSTACLES) expect(insideObstacle(resolveCollisions(o, MAP))).toBe(false);
  });

  it('điểm xuất hiện luôn hợp lệ', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const p = randomSpawn(MAP, rand);
      expect(insideObstacle(p)).toBe(false);
      expect(p.y).toBeGreaterThanOrEqual(WALK_BOUNDS.minY);
    }
  });
});

describe('bản đồ các khu', () => {
  for (const [id, map] of Object.entries(AREA_MAPS)) {
    it(`${id}: điểm xuất hiện ở lối vào không nằm trong vật cản`, () => {
      for (const entry of Object.values(map!.entrances)) {
        expect(resolveCollisions(entry!, map!)).toEqual(entry);
      }
    });
    it(`${id}: điểm đứng chờ của mỗi lối ra nằm trong vùng "ở gần" và đi tới được`, () => {
      for (const exit of map!.exits) {
        expect(inRect(exit.approach, exit.zone)).toBe(true);
        expect(resolveCollisions(exit.approach, map!)).toEqual(exit.approach);
        let r = step(
          randomSpawn(map!, () => 0.5),
          { kind: 'target', ...exit.approach },
          0.1,
          map!,
        );
        for (let i = 0; i < 200 && r.intent.kind !== 'idle'; i++) {
          r = step(r.pos, r.intent, 0.1, map!);
        }
        expect(inRect(r.pos, exit.zone)).toBe(true);
      }
    });
  }

  it('Chính điện: 40 chỗ ngồi, gần tượng Phật trước, không trùng nhau, không đè lên cột', () => {
    const hall = mapFor('chinh-dien');
    const seats = hall.seats!;
    expect(seats).toHaveLength(40);
    for (let i = 1; i < seats.length; i++)
      expect(seats[i]!.y).toBeGreaterThanOrEqual(seats[i - 1]!.y);
    expect(new Set(seats.map((s) => `${s.x},${s.y}`)).size).toBe(seats.length);
    for (const seat of seats) {
      expect(insideObstacle(seat, hall)).toBe(false);
      expect(Math.abs(seat.x - 600)).toBeGreaterThan(110); // chừa lối thảm đỏ ở giữa
    }
    // Trong cùng hàng: chỗ sát lối giữa được xếp trước.
    const firstRow = seats.slice(0, 8).map((s) => Math.abs(s.x - 600));
    expect(firstRow).toEqual([...firstRow].sort((a, b) => a - b));
  });

  it('mọi lối ra đều dẫn tới khu có lối vào ngược lại (đi qua rồi đi về được)', () => {
    for (const [id, map] of Object.entries(AREA_MAPS)) {
      for (const exit of map.exits) {
        const dest = AREA_MAPS[exit.to];
        // Khu có chỗ ngồi cố định (Chính điện) thì xếp chỗ thay cho lối vào.
        const arrives = dest.seats ?? dest.entrances[id as keyof typeof dest.entrances];
        expect(arrives, `${id} → ${exit.to}`).toBeDefined();
      }
    }
  });

  it('bấm đúng cửa điện / lòng cổng / biển chỉ lối thì nhận ra lối vào tương ứng', () => {
    expect(exitAt(mapFor('san-chua'), { x: 600, y: 250 })?.to).toBe('chinh-dien');
    expect(exitAt(mapFor('san-chua'), { x: 110, y: 720 })?.to).toBe('ho-sen');
    expect(exitAt(mapFor('san-chua'), { x: 1090, y: 720 })?.to).toBe('gac-chuong');
    expect(exitAt(mapFor('san-chua'), { x: 600, y: 744 })?.to).toBe('cong-tam-quan');
    expect(exitAt(mapFor('cong-tam-quan'), { x: 600, y: 300 })?.to).toBe('san-chua');
    expect(exitAt(mapFor('san-chua'), { x: 600, y: 600 })).toBeUndefined(); // giữa sân
  });

  it('ngoài sân chỉ thắp hương; lạy, cầu nguyện, công đức trong Chính điện', () => {
    expect(canDo('san-chua', 'incense')).toBe(true);
    for (const a of ['bow', 'prayer', 'donate'] as const) {
      expect(canDo('san-chua', a)).toBe(false);
      expect(canDo('chinh-dien', a)).toBe(true);
    }
    expect(canDo('chinh-dien', 'incense')).toBe(false);
  });
});
