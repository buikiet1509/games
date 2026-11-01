import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import { AreaScene } from './AreaScene';
import { drawPrayerMat } from './PlayerSprite';
import { C } from './palette';

const FLOOR_TOP = 440;
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Bên trong Chính điện: tượng Phật, bàn thờ, nến, hoa sen. Lạy Phật, cầu nguyện, công đức ở đây. */
export class HallScene extends AreaScene {
  constructor() {
    super('chinh-dien', 'chinh-dien');
  }

  protected drawEnvironment() {
    this.drawWall();
    this.drawBuddha();
    this.drawAltar();
    this.drawFloor();
    this.drawSeats();
    for (const o of this.map.obstacles) this.drawPillar(o.x, o.y);
  }

  /** Chỗ ngồi xếp sẵn: thảm mờ ở mọi chỗ, ai ngồi vào thì thảm của người đó hiện rõ lên trên. */
  private drawSeats() {
    const g = this.add.graphics().setDepth(-55).setAlpha(0.32);
    for (const seat of this.map.seats ?? []) drawPrayerMat(g, seat.x, seat.y);
  }

  private drawWall() {
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(C.red900).fillRect(0, 0, WORLD.width, FLOOR_TOP);
    g.lineStyle(2, C.redDark, 1);
    for (let x = 40; x < WORLD.width; x += 80) g.lineBetween(x, 34, x, FLOOR_TOP);
    // Xà ngang
    g.fillStyle(C.doorway).fillRect(0, 0, WORLD.width, 34);
    g.lineStyle(3, C.gold, 1).lineBetween(0, 34, WORLD.width, 34);
    // Biển hiệu
    g.fillStyle(C.red).fillRect(400, 48, 400, 44);
    g.lineStyle(2, C.gold, 1).strokeRect(405, 53, 390, 34);
    this.add
      .text(600, 70, 'NAM MÔ BỔN SƯ THÍCH CA MÂU NI PHẬT', {
        fontFamily: '"Noto Serif", Georgia, serif',
        fontStyle: 'bold',
        fontSize: '15px',
        color: '#e7c27a',
      })
      .setOrigin(0.5)
      .setDepth(-99);
    // Phướn treo hai bên
    for (const x of [300, 900]) {
      g.fillStyle(C.red).fillRect(x - 28, 34, 56, 220);
      g.lineStyle(2, C.gold, 1).strokeRect(x - 22, 40, 44, 208);
      g.fillStyle(C.goldLight).fillCircle(x, 140, 12);
      g.fillStyle(C.red).fillCircle(x, 140, 6);
      g.fillStyle(C.gold).fillTriangle(x - 28, 254, x + 28, 254, x, 276);
    }
  }

  private drawBuddha() {
    const g = this.add.graphics().setDepth(-90);
    const cx = 600;
    // Hào quang
    g.fillStyle(C.goldLight, 0.28).fillCircle(cx, 215, 116);
    g.fillStyle(C.goldLight, 0.22).fillCircle(cx, 215, 90);
    g.lineStyle(3, C.gold, 0.9).strokeCircle(cx, 215, 116);
    // Toà sen
    for (let i = -3; i <= 3; i++) {
      g.fillStyle(i % 2 ? C.lotusGold : C.gold).fillEllipse(cx + i * 30, 334, 44, 28);
    }
    g.fillStyle(C.bronzeLight).fillRect(cx - 110, 340, 220, 12);
    // Thân, vạt áo ngồi kiết già
    g.fillStyle(C.gold).fillEllipse(cx, 312, 196, 52);
    g.fillStyle(C.gold).fillRoundedRect(cx - 54, 188, 108, 122, 44);
    g.lineStyle(2, C.goldDeep, 0.8);
    g.strokePoints([V(cx - 30, 200), V(cx - 12, 250), V(cx - 40, 300)]);
    g.strokePoints([V(cx + 30, 200), V(cx + 12, 250), V(cx + 40, 300)]);
    // Tay kết ấn thiền định
    g.fillStyle(C.lotusGold).fillEllipse(cx, 290, 54, 18);
    // Đầu, nhục kế, tai
    g.fillStyle(C.lotusGold)
      .fillEllipse(cx - 34, 160, 12, 26)
      .fillEllipse(cx + 34, 160, 12, 26);
    g.fillStyle(C.lotusGold).fillCircle(cx, 156, 33);
    g.fillStyle(C.goldDeep).fillCircle(cx, 120, 13);
  }

  private drawAltar() {
    const g = this.add.graphics().setDepth(-80);
    // Bậc gỗ
    g.fillStyle(C.goldDeep).fillRect(320, 400, 560, 40);
    g.fillStyle(C.bronzeLight).fillRect(320, 400, 560, 6);
    // Bàn thờ
    g.fillStyle(C.gold).fillRect(370, 344, 460, 10);
    g.fillStyle(C.red).fillRect(380, 354, 440, 50);
    g.lineStyle(2, C.gold, 1).strokeRect(392, 362, 416, 34);
    g.fillStyle(C.goldLight).fillCircle(600, 379, 7);

    // Bình hoa sen
    for (const x of [490, 710]) {
      g.fillStyle(C.bronze).fillEllipse(x, 330, 28, 30);
      g.fillStyle(C.leaf)
        .fillEllipse(x - 12, 304, 18, 9)
        .fillEllipse(x + 12, 302, 18, 9);
      g.fillStyle(C.lotusPink)
        .fillCircle(x - 8, 298, 8)
        .fillCircle(x + 8, 294, 8)
        .fillCircle(x, 286, 9);
    }

    // Nến, ngọn lửa lung linh nhẹ
    for (const x of [425, 775]) {
      g.fillStyle(C.candle).fillRect(x - 4, 302, 8, 42);
      const glow = this.add.circle(x, 292, 18, C.goldLight, 0.25).setDepth(-79);
      const flame = this.add.ellipse(x, 292, 8, 15, C.ember).setDepth(-79);
      if (this.reducedMotion) continue;
      this.tweens.add({
        targets: [flame, glow],
        scaleY: { from: 0.9, to: 1.1 },
        duration: 420 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawFloor() {
    const g = this.add.graphics().setDepth(-60);
    g.fillStyle(C.woodFloor).fillRect(0, FLOOR_TOP, WORLD.width, WORLD.height - FLOOR_TOP);
    g.lineStyle(1.5, C.woodLine, 1);
    for (let i = 1, y = FLOOR_TOP; y < WORLD.height; i++) {
      g.lineBetween(0, y, WORLD.width, y);
      y += 16 + i * 12;
    }
    // Thảm dẫn lối từ cửa lên bàn thờ (đỏ trầm, để thảm lạy đỏ tươi nổi lên trên)
    g.fillStyle(C.redDark, 0.95).fillPoints(
      [V(540, FLOOR_TOP), V(660, FLOOR_TOP), V(710, WORLD.height), V(490, WORLD.height)],
      true,
    );
    g.lineStyle(2, C.gold, 0.9);
    g.lineBetween(548, FLOOR_TOP, 502, WORLD.height);
    g.lineBetween(652, FLOOR_TOP, 698, WORLD.height);
  }

  private drawPillar(x: number, baseY: number) {
    const g = this.add.graphics().setDepth(baseY);
    g.fillStyle(C.red).fillRect(x - 22, 34, 44, baseY - 34);
    g.fillStyle(C.redDark).fillRect(x + 8, 34, 14, baseY - 34);
    g.fillStyle(C.gold).fillRect(x - 26, 34, 52, 14);
    g.fillStyle(C.stone).fillRect(x - 28, baseY - 14, 56, 18);
  }
}
