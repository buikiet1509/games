import Phaser from 'phaser';
import type { ActivityItem } from '@chua/shared';
import { AreaScene } from './AreaScene';
import { C } from './palette';
import {
  drawSignpost,
  drawSkyHills,
  drawStoneGround,
  drawTree,
  roofBand,
  strokeCurl,
} from './scenery';

const GROUND_TOP = 420;
const BELL_PIVOT = { x: 600, y: 196 };
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Gác chuông: lầu chuông với chuông đồng lớn. Thỉnh chuông thì cả khu cùng thấy chuông ngân. */
export class BellTowerScene extends AreaScene {
  private bell!: Phaser.GameObjects.Graphics;
  private striker!: Phaser.GameObjects.Container;

  constructor() {
    super('gac-chuong', 'gac-chuong');
  }

  protected drawEnvironment() {
    drawSkyHills(this, GROUND_TOP - 20, 900);
    drawStoneGround(this, GROUND_TOP, 240);
    drawTree(this, 150, 432, 0.9);
    drawTree(this, 1060, 434, 1.05);
    this.drawPavilion();
    drawSignpost(this, 110, 720, '←  Sân chùa');
  }

  protected playActivity(item: ActivityItem) {
    super.playActivity(item);
    if (item.kind === 'bell') this.ringBell();
  }

  private drawPavilion() {
    const g = this.add.graphics().setDepth(-50);
    // Nền lầu
    g.fillStyle(C.stoneDark).fillRect(400, GROUND_TOP, 400, 34);
    g.fillStyle(C.stone).fillRect(400, GROUND_TOP, 400, 8);
    // Cột và xà
    for (const o of this.map.obstacles) {
      g.fillStyle(C.red).fillRect(o.x - 12, 160, 24, o.y - 160);
      g.fillStyle(C.redDark).fillRect(o.x + 4, 160, 8, o.y - 160);
    }
    g.fillStyle(C.trunk).fillRect(440, 184, 320, 14);
    // Mái hai tầng
    g.fillStyle(C.redDark);
    g.fillPoints(roofBand(380, 820, 168, 142, 20), true);
    g.fillPoints(roofBand(450, 750, 104, 84, 18), true);
    g.lineStyle(5, C.redDark);
    strokeCurl(g, 380, 168, -1);
    strokeCurl(g, 820, 168, 1);
    strokeCurl(g, 450, 104, -1);
    strokeCurl(g, 750, 104, 1);

    // Chuông: vẽ quanh điểm treo để xoay được (đung đưa khi thỉnh).
    this.bell = this.add.graphics({ x: BELL_PIVOT.x, y: BELL_PIVOT.y }).setDepth(-49);
    const b = this.bell;
    b.lineStyle(4, C.trunk).lineBetween(0, 0, 0, 16);
    b.fillStyle(C.bronze).fillEllipse(0, 30, 74, 34);
    b.fillPoints([V(-37, 30), V(37, 30), V(52, 140), V(-52, 140)], true);
    b.fillStyle(C.bronzeLight).fillEllipse(0, 140, 112, 22);
    b.lineStyle(3, C.gold, 0.9).lineBetween(-42, 64, 42, 64).lineBetween(-47, 104, 47, 104);
    b.fillStyle(C.gold).fillCircle(0, 122, 7); // núm đánh chuông

    // Chày gỗ treo bằng hai dây bên trái chuông
    const ropes = this.add.graphics();
    ropes.lineStyle(2, C.trunk).lineBetween(-22, -100, -22, 0).lineBetween(22, -100, 22, 0);
    const log = this.add.graphics();
    log.fillStyle(C.trunk).fillRoundedRect(-55, -9, 110, 18, 9);
    log.fillStyle(C.bronze).fillCircle(50, 0, 7);
    this.striker = this.add.container(470, 298, [ropes, log]).setDepth(-48);
  }

  private ringBell() {
    // Chày đánh vào chuông
    this.tweens.add({
      targets: this.striker,
      x: 492,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeIn',
    });
    // Chuông đung đưa nhẹ, tắt dần
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: 3200,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        this.bell.rotation = Math.sin((1 - k) * 22) * 0.06 * k;
      },
    });
    // Sóng âm lan ra cho cả khu thấy
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .circle(BELL_PIVOT.x, BELL_PIVOT.y + 90, 60)
        .setStrokeStyle(3, C.gold)
        .setDepth(-47);
      this.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: { from: 0.8, to: 0 },
        delay: i * 450,
        duration: 2200,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }
}
