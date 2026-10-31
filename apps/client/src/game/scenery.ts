import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import { C } from './palette';

// Các phần cảnh dùng chung giữa các khu (vẽ bằng Graphics, không cần asset ảnh).

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Đường cong mượt qua các điểm (Catmull-Rom) để fill. */
export function smooth(points: [number, number][]) {
  return new Phaser.Curves.Spline(points.flat()).getPoints(64);
}

/** Nền giấy dó, mặt trời và hai lớp đồi xa. `horizon`: chân đồi. */
export function drawSkyHills(scene: Phaser.Scene, horizon: number, sunX = 1000) {
  const g = scene.add.graphics().setDepth(-100);
  g.fillStyle(C.paper).fillRect(0, 0, WORLD.width, WORLD.height);
  g.fillStyle(C.sun).fillCircle(sunX, 115, 52);
  const h = horizon;
  g.fillStyle(C.hillFar).fillPoints(
    smooth([
      [0, h - 45],
      [180, h - 135],
      [420, h - 75],
      [700, h - 145],
      [980, h - 95],
      [1200, h - 130],
      [1200, h],
      [0, h],
    ]),
    true,
  );
  g.fillStyle(C.hill).fillPoints(
    smooth([
      [0, h - 15],
      [260, h - 75],
      [520, h - 25],
      [820, h - 77],
      [1200, h - 35],
      [1200, h],
      [0, h],
    ]),
    true,
  );
  return g;
}

/** Sân lát đá phối cảnh từ `top` xuống đáy cảnh. */
export function drawStoneGround(scene: Phaser.Scene, top: number, vanishY = 180) {
  const g = scene.add.graphics().setDepth(-60);
  const vx = WORLD.width / 2;
  g.fillStyle(C.terrace).fillRect(0, top, WORLD.width, 22);
  g.fillStyle(C.ground).fillRect(0, top + 22, WORLD.width, WORLD.height);
  g.lineStyle(1.5, C.groundLine, 1);
  // Đường gạch ngang dãn dần về phía người xem
  for (let i = 1, y = top + 22; y < WORLD.height; i++) {
    g.lineBetween(0, y, WORLD.width, y);
    y += 18 + i * 14;
  }
  // Đường gạch dọc hội tụ về điểm tụ
  for (let x = -1200; x <= WORLD.width + 1200; x += 170) {
    const t = (top + 22 - vanishY) / (WORLD.height - vanishY);
    g.lineBetween(vx + (x - vx) * t, top + 22, x, WORLD.height);
  }
  return g;
}

/** Bãi cỏ (cho Hồ sen, Gác chuông). */
export function drawGrass(scene: Phaser.Scene, top: number) {
  const g = scene.add.graphics().setDepth(-60);
  g.fillStyle(C.grass).fillRect(0, top, WORLD.width, WORLD.height - top);
  g.fillStyle(C.grassLight, 0.6);
  for (let i = 0; i < 70; i++) {
    const x = (i * 197) % WORLD.width;
    const y = top + 20 + ((i * 89) % (WORLD.height - top - 20));
    g.fillEllipse(x, y, 26, 6);
  }
  return g;
}

/** Cây bồ đề tán tròn; (x, y) là gốc cây. */
export function drawTree(scene: Phaser.Scene, x: number, y: number, size = 1) {
  const g = scene.add.graphics().setDepth(y);
  g.fillStyle(C.shadow, 0.12).fillEllipse(x, y + 6, 120 * size, 26 * size);
  g.fillStyle(C.trunk).fillRect(x - 10 * size, y - 125 * size, 20 * size, 130 * size);
  g.fillStyle(C.leaf).fillCircle(x, y - 170 * size, 84 * size);
  g.fillStyle(C.leafLight).fillCircle(x - 38 * size, y - 208 * size, 52 * size);
  return g;
}

/** Đèn đá; (x, y) là chân đèn. */
export function drawStoneLantern(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics().setDepth(y);
  g.fillStyle(C.shadow, 0.12).fillEllipse(x, y + 4, 60, 14);
  g.fillStyle(C.stoneDark).fillRect(x - 18, y - 12, 36, 14);
  g.fillStyle(C.stone).fillRect(x - 7, y - 62, 14, 52);
  g.fillStyle(C.stoneDark).fillRect(x - 20, y - 92, 40, 30);
  g.fillStyle(C.ember, 0.8).fillRect(x - 9, y - 84, 18, 14);
  g.fillStyle(C.stone).fillPoints(
    [V(x - 30, y - 92), V(x + 30, y - 92), V(x + 12, y - 112), V(x - 12, y - 112)],
    true,
  );
  g.fillStyle(C.stoneDark).fillCircle(x, y - 116, 6);
  return g;
}

/** Biển chỉ lối (chữ trắng trên nền mờ), nằm dưới nhân vật. */
export function drawSignpost(scene: Phaser.Scene, x: number, y: number, text: string) {
  const label = scene.add
    .text(x, y, text, {
      font: '600 13px "Be Vietnam Pro", system-ui, sans-serif',
      color: '#fffbf2',
    })
    .setOrigin(0.5)
    .setDepth(-40);
  scene.add
    .graphics()
    .setDepth(-41)
    .fillStyle(C.ink, 0.45)
    .fillRoundedRect(x - label.width / 2 - 12, y - 13, label.width + 24, 26, 13);
}

/** Mái cong: mép trên võng lên ở giữa, hai đầu hạ thấp. */
export function roofBand(x0: number, x1: number, yEdge: number, yMid: number, thickness: number) {
  const top = new Phaser.Curves.QuadraticBezier(
    V(x0, yEdge),
    V((x0 + x1) / 2, 2 * yMid - yEdge),
    V(x1, yEdge),
  ).getPoints(40);
  const bottom = top.map((p) => V(p.x, p.y + thickness)).reverse();
  return [...top, ...bottom];
}

/** Đầu đao vểnh ở mép mái. */
export function strokeCurl(g: Phaser.GameObjects.Graphics, x: number, y: number, side: -1 | 1) {
  new Phaser.Curves.QuadraticBezier(
    V(x - side * 6, y + 14),
    V(x + side * 14, y + 6),
    V(x + side * 18, y - 22),
  ).draw(g);
}
