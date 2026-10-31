import Phaser from 'phaser';
import { C, parseColor } from './palette';
import { Interpolator } from './interpolator';

const LABEL_FONT = '600 13px "Be Vietnam Pro", system-ui, sans-serif';

/** Nhân vật: bóng, áo, đầu, nhãn tên; nhân vật của mình có vòng vàng và nhãn "Bạn". */
export class PlayerSprite extends Phaser.GameObjects.Container {
  readonly motion = new Interpolator();
  private body_: Phaser.GameObjects.Container;
  private moving = false;
  private walkPhase = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    opts: { name: string; robeColor: string; isSelf: boolean; x: number; y: number },
  ) {
    super(scene, opts.x, opts.y);
    this.motion.reset(performance.now(), opts.x, opts.y);

    const shadow = scene.add.ellipse(0, 0, 46, 13, C.shadow, 0.13);
    this.add(shadow);

    if (opts.isSelf) {
      const ring = scene.add.ellipse(0, 2, 84, 24);
      ring.setStrokeStyle(2.5, C.gold);
      this.add(ring);
    }

    const robe = scene.add.graphics();
    robe.fillStyle(parseColor(opts.robeColor), 1);
    robe.fillRoundedRect(-22, -38, 44, 38, { tl: 22, tr: 22, bl: 5, br: 5 });
    robe.fillStyle(C.shadow, 0.12);
    robe.fillRect(-22, -6, 44, 6);
    const head = scene.add.circle(0, -50, 13, C.skin);
    this.body_ = scene.add.container(0, 0, [robe, head]);
    this.add(this.body_);

    this.add(this.makeLabel(opts.isSelf ? 'Bạn' : opts.name, opts.isSelf));
    this.setSize(50, 90);
    scene.add.existing(this);
  }

  private makeLabel(text: string, isSelf: boolean) {
    const label = this.scene.add.text(0, 0, text, {
      font: LABEL_FONT,
      color: isSelf ? '#ffffff' : '#2b1b12',
    });
    label.setOrigin(0.5);
    const w = Math.max(44, label.width + 24);
    const h = 26;
    const bg = this.scene.add.graphics();
    if (isSelf) {
      bg.fillStyle(C.red, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else {
      bg.fillStyle(C.white, 0.96);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(1, C.labelBorder, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
    return this.scene.add.container(0, -86, [bg, label]);
  }

  setMoving(moving: boolean) {
    this.moving = moving;
  }

  /** Gọi mỗi khung hình: cập nhật vị trí nội suy, chiều sâu theo y, nhún nhẹ khi đi. */
  tick(now: number, dtMs: number) {
    const p = this.motion.sample(now);
    const dx = p.x - this.x;
    this.setPosition(p.x, p.y);
    this.setDepth(p.y);
    if (this.moving || Math.abs(dx) > 0.2) {
      this.walkPhase += dtMs * 0.018;
      this.body_.y = -Math.abs(Math.sin(this.walkPhase)) * 3;
    } else {
      this.body_.y *= 0.8;
    }
  }
}
