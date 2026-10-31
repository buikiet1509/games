import Phaser from 'phaser';
import type { Vec } from '@chua/shared';
import { AreaScene } from './AreaScene';
import { drawSignpost, drawSkyHills, drawStoneGround, drawTree } from './scenery';
import { C } from './palette';

const GROUND_TOP = 340;
/** Mặt tiền Chính điện: click vào thì đi lên hiên để vào trong. */
const HALL_FRONT = { minX: 300, maxX: 900, minY: 120, maxY: 400 };

/** Sân chùa: trước Chính điện, lư hương có khói, cây bồ đề, sân lát đá. Chỉ thắp hương ở đây. */
export class CourtyardScene extends AreaScene {
  constructor() {
    super('san-chua', 'san-chua');
  }

  protected drawEnvironment() {
    drawSkyHills(this, GROUND_TOP + 5);
    this.drawHall();
    drawStoneGround(this, GROUND_TOP);
    this.drawCenser();
    const tree = (id: string) => this.map.obstacles.find((o) => o.id === id)!;
    drawTree(this, tree('cay-trai').x, tree('cay-trai').y, 1.15);
    drawTree(this, tree('cay-phai').x, tree('cay-phai').y, 0.95);
    drawSignpost(this, 450, 388, '↑  Vào Chính điện');
    drawSignpost(this, 110, 720, '←  Hồ sen');
    drawSignpost(this, 1090, 720, 'Gác chuông  →');
    drawSignpost(this, 600, 744, '↓  Cổng Tam Quan');
  }

  protected redirectClick(p: Vec): Vec | null {
    const f = HALL_FRONT;
    if (p.x >= f.minX && p.x <= f.maxX && p.y >= f.minY && p.y <= f.maxY) {
      // Đi lên hiên điện, vòng qua lư hương ở giữa.
      return { x: p.x < 600 ? 450 : 750, y: this.map.walk.minY };
    }
    return super.redirectClick(p);
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
}
