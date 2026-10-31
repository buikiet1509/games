import Phaser from 'phaser';
import { AreaScene } from './AreaScene';
import { C } from './palette';
import { drawGrass, drawSignpost, drawSkyHills, drawStoneLantern, drawTree } from './scenery';

const POND = { x: 600, y: 562, rx: 330, ry: 115 };

/** Hồ sen: hồ nước giữa cảnh với lá sen, hoa sen; lối đá quanh hồ. Chốn ngồi ngắm, trò chuyện. */
export class PondScene extends AreaScene {
  constructor() {
    super('ho-sen', 'ho-sen');
  }

  protected drawEnvironment() {
    drawSkyHills(this, 365, 260);
    drawGrass(this, 360);
    drawTree(this, 130, 372, 0.95);
    drawTree(this, 1070, 370, 0.8);
    drawStoneLantern(this, 960, 376);
    this.drawPond();
    drawSignpost(this, 1090, 720, 'Sân chùa  →');
  }

  private drawPond() {
    const g = this.add.graphics().setDepth(-58);
    // Bờ đá quanh hồ rồi mặt nước
    g.fillStyle(C.stone).fillEllipse(POND.x, POND.y + 6, POND.rx * 2 + 70, POND.ry * 2 + 56);
    g.fillStyle(C.water).fillEllipse(POND.x, POND.y, POND.rx * 2, POND.ry * 2);
    // Gợn sóng lăn tăn
    for (const [x, y, w] of [
      [470, 520, 90],
      [700, 610, 120],
      [610, 500, 70],
      [800, 545, 80],
    ] as const) {
      const ripple = this.add
        .ellipse(x, y, w, w / 5)
        .setStrokeStyle(1.5, C.waterLight)
        .setDepth(-57);
      this.tweens.add({
        targets: ripple,
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: { from: 0.9, to: 0.2 },
        duration: 2600 + w * 10,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // Lá sen (hình tròn khuyết) và hoa sen — vị trí cố định để mọi người thấy giống nhau.
    const pads: [number, number, number, boolean][] = [
      [360, 560, 18, true],
      [420, 600, 14, false],
      [455, 515, 16, false],
      [540, 630, 20, true],
      [600, 545, 15, false],
      [665, 505, 17, true],
      [730, 590, 19, false],
      [790, 520, 14, true],
      [850, 575, 18, false],
      [500, 570, 13, false],
      [700, 640, 14, true],
      [620, 600, 12, false],
    ];
    const lotus = this.add.graphics().setDepth(-56);
    pads.forEach(([x, y, r, flower], i) => {
      const start = Phaser.Math.DegToRad(i * 47);
      lotus
        .fillStyle(C.pad)
        .slice(x, y, r, start, start + Phaser.Math.DegToRad(320), false)
        .fillPath();
      if (flower) {
        lotus.fillStyle(C.lotusPink);
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * 0.45;
          lotus.fillEllipse(x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 6, 7, 12);
        }
        lotus.fillStyle(C.goldLight).fillCircle(x, y - 6, 2.5);
      }
    });
  }
}
