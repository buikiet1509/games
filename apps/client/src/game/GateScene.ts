import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import { AreaScene } from './AreaScene';
import { C } from './palette';
import {
  drawSignpost,
  drawSkyHills,
  drawStoneGround,
  drawStoneLantern,
  roofBand,
  strokeCurl,
} from './scenery';

const GROUND_TOP = 400;
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Cổng Tam Quan: nơi bắt đầu. Đi qua cửa giữa để vào Sân chùa. */
export class GateScene extends AreaScene {
  constructor() {
    super('cong-tam-quan', 'cong-tam-quan');
  }

  protected drawEnvironment() {
    drawSkyHills(this, GROUND_TOP - 40, 230);
    this.drawWalls();
    this.drawGate();
    drawStoneGround(this, GROUND_TOP, 220);
    this.drawPath();
    for (const o of this.map.obstacles) drawStoneLantern(this, o.x, o.y);
    drawSignpost(this, 600, 452, '↑  Vào Sân chùa');
  }

  private drawWalls() {
    const g = this.add.graphics().setDepth(-70);
    for (const [x0, x1] of [
      [0, 360],
      [840, WORLD.width],
    ] as const) {
      g.fillStyle(C.terrace).fillRect(x0, 330, x1 - x0, 80);
      g.fillStyle(C.redDark).fillRect(x0, 322, x1 - x0, 12);
      g.lineStyle(1.5, C.groundLine, 1);
      for (let x = x0 + 40; x < x1; x += 60) g.strokeCircle(x, 370, 10); // hoa văn tròn trên tường
    }
  }

  private drawGate() {
    const g = this.add.graphics().setDepth(-50);
    // Ba lối: giữa lớn, hai bên nhỏ; lòng cửa sáng (thấy sân chùa phía trong)
    const bays = [
      { x0: 360, x1: 480, top: 290 },
      { x0: 500, x1: 700, top: 250 },
      { x0: 720, x1: 840, top: 290 },
    ];
    for (const b of bays) {
      g.fillStyle(C.red).fillRect(b.x0, b.top, b.x1 - b.x0, GROUND_TOP + 10 - b.top);
      g.fillStyle(C.terrace).fillRect(
        b.x0 + 14,
        b.top + 34,
        b.x1 - b.x0 - 28,
        GROUND_TOP + 10 - b.top - 34,
      );
      g.lineStyle(2.5, C.goldLight, 1);
      new Phaser.Curves.QuadraticBezier(
        V(b.x0 + 14, b.top + 58),
        V((b.x0 + b.x1) / 2, b.top + 20),
        V(b.x1 - 14, b.top + 58),
      ).draw(g);
    }
    // Mái hai bên
    g.fillStyle(C.redDark);
    g.fillPoints(roofBand(340, 500, 285, 270, 14), true);
    g.fillPoints(roofBand(700, 860, 285, 270, 14), true);
    // Mái giữa hai tầng
    g.fillPoints(roofBand(450, 750, 240, 220, 18), true);
    g.fillPoints(roofBand(480, 720, 168, 150, 16), true);
    g.lineStyle(5, C.redDark);
    strokeCurl(g, 340, 285, -1);
    strokeCurl(g, 860, 285, 1);
    strokeCurl(g, 450, 240, -1);
    strokeCurl(g, 750, 240, 1);
    // Biển "TAM QUAN"
    g.fillStyle(C.red).fillRect(530, 180, 140, 40);
    g.lineStyle(2, C.goldLight).strokeRect(534, 184, 132, 32);
    this.add
      .text(600, 200, 'TAM QUAN', {
        fontFamily: '"Noto Serif", Georgia, serif',
        fontStyle: 'bold',
        fontSize: '19px',
        color: '#e7c27a',
      })
      .setOrigin(0.5)
      .setDepth(-49);
  }

  private drawPath() {
    const g = this.add.graphics().setDepth(-55);
    g.fillStyle(C.stone, 0.7).fillPoints(
      [
        V(520, GROUND_TOP + 20),
        V(680, GROUND_TOP + 20),
        V(800, WORLD.height),
        V(400, WORLD.height),
      ],
      true,
    );
    g.lineStyle(1.5, C.stoneDark, 0.8);
    for (let i = 1, y = GROUND_TOP + 40; y < WORLD.height; i++, y += 20 + i * 8) {
      const t = (y - GROUND_TOP - 20) / (WORLD.height - GROUND_TOP - 20);
      g.lineBetween(520 - 120 * t, y, 680 + 120 * t, y);
    }
  }
}
