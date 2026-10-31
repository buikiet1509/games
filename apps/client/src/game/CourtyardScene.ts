import Phaser from 'phaser';
import { WORLD, type Vec } from '@chua/shared';
import { AreaScene } from './AreaScene';
import { C } from './palette';

const VANISH = { x: WORLD.width / 2, y: 180 };
const GROUND_TOP = 340;
/** Mặt tiền Chính điện: click vào thì đi lên hiên để vào trong. */
const HALL_FRONT = { minX: 300, maxX: 900, minY: 120, maxY: 400 };

/** Sân chùa: trước Chính điện, lư hương có khói, cây bồ đề, sân lát đá. Chỉ thắp hương ở đây. */
export class CourtyardScene extends AreaScene {
  constructor() {
    super('san-chua', 'san-chua');
  }

  protected drawEnvironment() {
    this.drawBackdrop();
    this.drawHall();
    this.drawGround();
    this.drawCenser();
    const tree = (id: string) => this.map.obstacles.find((o) => o.id === id)!;
    this.drawTree(tree('cay-trai'), 1.15);
    this.drawTree(tree('cay-phai'), 0.95);
    this.drawEntranceHint();
  }

  /** Nhãn chỉ lối lên hiên vào Chính điện. */
  private drawEntranceHint() {
    const label = this.add
      .text(450, 388, '↑  Vào Chính điện', {
        font: '600 13px "Be Vietnam Pro", system-ui, sans-serif',
        color: '#fffbf2',
      })
      .setOrigin(0.5)
      .setDepth(-40);
    this.add
      .graphics()
      .setDepth(-41)
      .fillStyle(C.ink, 0.45)
      .fillRoundedRect(450 - label.width / 2 - 12, 375, label.width + 24, 26, 13);
  }

  protected redirectClick(p: Vec): Vec | null {
    const f = HALL_FRONT;
    if (p.x >= f.minX && p.x <= f.maxX && p.y >= f.minY && p.y <= f.maxY) {
      // Đi lên hiên điện, vòng qua lư hương ở giữa.
      return { x: p.x < 600 ? 450 : 750, y: this.map.walk.minY };
    }
    return super.redirectClick(p);
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(C.paper).fillRect(0, 0, WORLD.width, WORLD.height);
    g.fillStyle(C.sun).fillCircle(1000, 115, 52);
    // Đồi xa
    g.fillStyle(C.hillFar);
    g.fillPoints(
      this.curve([
        [0, 300],
        [180, 210],
        [420, 270],
        [700, 200],
        [980, 250],
        [1200, 215],
        [1200, 345],
        [0, 345],
      ]),
      true,
    );
    g.fillStyle(C.hill);
    g.fillPoints(
      this.curve([
        [0, 330],
        [260, 270],
        [520, 320],
        [820, 268],
        [1200, 310],
        [1200, 345],
        [0, 345],
      ]),
      true,
    );
  }

  private drawHall() {
    const g = this.add.graphics().setDepth(-50);
    // Thân điện
    g.fillStyle(C.red).fillRect(330, 205, 540, 140);
    g.fillStyle(C.red900).fillRect(372, 245, 104, 72).fillRect(724, 245, 104, 72);
    g.fillStyle(C.doorway).fillRect(520, 232, 160, 113);
    // Đĩa đồng trong cửa
    g.fillStyle(C.gold).fillCircle(600, 280, 33);
    g.fillStyle(C.goldLight).fillCircle(592, 268, 11);
    // Đèn lồng hai bên
    g.fillStyle(C.lantern).fillEllipse(330, 238, 22, 30).fillEllipse(870, 238, 22, 30);

    // Mái cong: dải dưới rồi dải trên, đầu đao vểnh
    g.fillStyle(C.redDark);
    g.fillPoints(this.roofBand(250, 950, 222, 196, 20), true);
    g.fillPoints(this.roofBand(300, 900, 150, 128, 16), true);
    g.lineStyle(5, C.redDark);
    this.strokeCurl(g, 250, 222, -1);
    this.strokeCurl(g, 950, 222, 1);

    // Biển "Đại Hùng Bảo Điện"
    g.fillStyle(C.gold).fillRect(472, 178, 256, 38);
    this.add
      .text(600, 197, 'ĐẠI HÙNG BẢO ĐIỆN', {
        fontFamily: '"Noto Serif", Georgia, serif',
        fontStyle: 'bold',
        fontSize: '19px',
        color: '#5e1212',
      })
      .setOrigin(0.5)
      .setDepth(-49);
  }

  private drawGround() {
    const g = this.add.graphics().setDepth(-60);
    g.fillStyle(C.terrace).fillRect(0, GROUND_TOP, WORLD.width, 22);
    g.fillStyle(C.ground).fillRect(0, GROUND_TOP + 22, WORLD.width, WORLD.height);
    g.lineStyle(1.5, C.groundLine, 1);
    // Đường gạch ngang dãn dần về phía người xem (phối cảnh)
    for (let i = 1, y = GROUND_TOP + 22; y < WORLD.height; i++) {
      g.lineBetween(0, y, WORLD.width, y);
      y += 18 + i * 14;
    }
    // Đường gạch dọc hội tụ về điểm tụ
    for (let x = -1200; x <= WORLD.width + 1200; x += 170) {
      const t = (GROUND_TOP + 22 - VANISH.y) / (WORLD.height - VANISH.y);
      g.lineBetween(VANISH.x + (x - VANISH.x) * t, GROUND_TOP + 22, x, WORLD.height);
    }
  }

  private drawCenser() {
    const o = this.map.obstacles.find((ob) => ob.id === 'lu-huong')!;
    const base = this.add.graphics().setDepth(o.y);
    base.fillStyle(C.shadow, 0.12).fillEllipse(o.x, o.y + 18, 210, 44);
    base.fillStyle(C.bronze);
    base.fillPoints(
      [
        new Phaser.Math.Vector2(o.x - 82, o.y - 52),
        new Phaser.Math.Vector2(o.x + 82, o.y - 52),
        new Phaser.Math.Vector2(o.x + 56, o.y + 14),
        new Phaser.Math.Vector2(o.x - 56, o.y + 14),
      ],
      true,
    );
    base.fillStyle(C.bronzeLight).fillRoundedRect(o.x - 94, o.y - 66, 188, 18, 5);

    // Ba nén hương và đốm lửa
    const tips: { x: number; y: number }[] = [];
    for (const dx of [-20, 0, 20]) {
      const top = o.y - 124 - (dx === 0 ? 8 : 0);
      base.lineStyle(3, C.red, 1).lineBetween(o.x + dx, o.y - 66, o.x + dx, top);
      base.fillStyle(C.ember).fillCircle(o.x + dx, top, 3.5);
      tips.push({ x: o.x + dx, y: top });
    }

    // Khói hương: hạt mờ bay lên, lắc nhẹ
    if (!this.textures.exists('smoke')) {
      const t = this.make.graphics({}, false);
      t.fillStyle(0xffffff).fillCircle(8, 8, 8);
      t.generateTexture('smoke', 16, 16);
      t.destroy();
    }
    for (const tip of tips) {
      const smoke = this.add
        .particles(tip.x, tip.y, 'smoke', {
          lifespan: 2600,
          frequency: 260,
          speedY: { min: -26, max: -18 },
          speedX: { min: -5, max: 5 },
          accelerationX: { min: -4, max: 4 },
          scale: { start: 0.25, end: 1.1 },
          alpha: { start: 0.35, end: 0 },
          tint: 0xd9cfc0,
        })
        .setDepth(o.y + 1);
      this.censerSmoke.push(smoke);
    }
  }

  private drawTree(o: { x: number; y: number }, size: number) {
    const g = this.add.graphics().setDepth(o.y);
    g.fillStyle(C.shadow, 0.12).fillEllipse(o.x, o.y + 6, 120 * size, 26 * size);
    g.fillStyle(C.trunk).fillRect(o.x - 10 * size, o.y - 125 * size, 20 * size, 130 * size);
    g.fillStyle(C.leaf).fillCircle(o.x, o.y - 170 * size, 84 * size);
    g.fillStyle(C.leafLight).fillCircle(o.x - 38 * size, o.y - 208 * size, 52 * size);
  }
}
