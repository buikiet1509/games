import Phaser from 'phaser';
import { BOW_HOLD_MS } from '@chua/shared';
import { C, parseColor } from './palette';
import { Interpolator } from './interpolator';

const LABEL_FONT = '600 13px "Be Vietnam Pro", system-ui, sans-serif';
const LABEL_Y = -86;
const SEATED_LABEL_Y = 28;
/** Quỳ xuống / đứng lên mất bao lâu. */
const KNEEL_MS = 320;
/** Ngẩng lên sau mỗi lạy mất bao lâu (cúi xuống thì khớp đúng thời gian nhấn giữ). */
const RISE_MS = 450;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

/** Nhân vật: bóng, áo, đầu, nhãn tên; nhân vật của mình có vòng vàng và nhãn "Bạn". */
export class PlayerSprite extends Phaser.GameObjects.Container {
  readonly motion = new Interpolator();
  private body_: Phaser.GameObjects.Container;
  private robe: Phaser.GameObjects.Graphics;
  private collar: Phaser.GameObjects.Graphics;
  private seam: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Arc;
  private hands: [Phaser.GameObjects.Ellipse, Phaser.GameObjects.Ellipse];
  private mat: Phaser.GameObjects.Graphics;
  private nameLabel: Phaser.GameObjects.Container;
  private nameLabelWidth = 0;
  private moving = false;
  private walkPhase = Math.random() * Math.PI * 2;
  /** Tư thế hiện tại (0..1) và đích theo trạng thái từ server. */
  private kneel = 0;
  private bend = 0;
  private kneelTarget = 0;
  private bendTarget = 0;
  private headBehind = false;
  private seated = false;
  private bowingTag?: Phaser.GameObjects.Container;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    opts: {
      name: string;
      robeColor: string;
      isSelf: boolean;
      x: number;
      y: number;
      /** Ngồi cố định theo hàng (Chính điện): nhãn tên đặt dưới chân để không đè lên hàng trước. */
      seated?: boolean;
    },
  ) {
    super(scene, opts.x, opts.y);
    this.seated = Boolean(opts.seated);
    this.motion.reset(performance.now(), opts.x, opts.y);

    const shadow = scene.add.ellipse(0, 0, 46, 13, C.shadow, 0.13);
    this.add(shadow);

    if (opts.isSelf) {
      const ring = scene.add.ellipse(0, 2, 84, 24);
      ring.setStrokeStyle(2.5, C.gold);
      this.add(ring);
    }

    this.mat = this.makeMat();
    this.add(this.mat);

    // Áo vẽ từ chân (y=0) lên trên → co theo trục y quanh gốc là "hạ thấp người" xuống.
    this.robe = scene.add.graphics();
    this.robe.fillStyle(parseColor(opts.robeColor), 1);
    this.robe.fillRoundedRect(-22, -38, 44, 38, { tl: 22, tr: 22, bl: 5, br: 5 });
    this.robe.fillStyle(C.shadow, 0.12);
    this.robe.fillRect(-22, -6, 44, 6);
    // Cổ áo chữ V (mặt trước) và đường may sống lưng (mặt sau) — cho biết nhân vật quay hướng nào.
    this.collar = scene.add.graphics();
    this.collar
      .lineStyle(3, C.skin, 1)
      .strokePoints([
        new Phaser.Math.Vector2(-7, -37),
        new Phaser.Math.Vector2(0, -27),
        new Phaser.Math.Vector2(7, -37),
      ]);
    this.seam = scene.add.graphics();
    this.seam.lineStyle(2, C.shadow, 0.2).lineBetween(0, -36, 0, -4);
    this.seam.setAlpha(0);
    this.head = scene.add.circle(0, -50, 13, C.skin);
    // Hai bàn tay vươn ra đặt lên thảm (phía trước, hướng về chùa) khi cúi lạy.
    this.hands = [
      scene.add.ellipse(0, 0, 9, 11, C.skin).setStrokeStyle(1, C.skinShade),
      scene.add.ellipse(0, 0, 9, 11, C.skin).setStrokeStyle(1, C.skinShade),
    ];
    // Thứ tự vẽ mặc định: áo, chi tiết áo, đầu; tay nằm dưới cùng (khi cúi, tay vươn ra phía trước, khuất sau lưng).
    this.body_ = scene.add.container(0, 0, [
      ...this.hands,
      this.robe,
      this.collar,
      this.seam,
      this.head,
    ]);
    this.add(this.body_);

    this.nameLabel = this.makeLabel(opts.isSelf ? 'Bạn' : opts.name, opts.isSelf);
    this.add(this.nameLabel);
    this.applyPose();
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
    this.nameLabelWidth = w;
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
    return this.scene.add.container(0, LABEL_Y, [bg, label]);
  }

  private makeMat() {
    const g = this.scene.add.graphics();
    drawPrayerMat(g, 0, 0);
    g.setAlpha(0);
    return g;
  }

  setMoving(moving: boolean) {
    this.moving = moving;
  }

  /**
   * Tư thế từ server: 'kneeling' → trải thảm, quỳ xuống; 'bowing' → cúi rạp xuống thảm
   * (bắt đầu đúng lúc người đó nhấn giữ); '' → đứng dậy, cuộn thảm.
   */
  setAction(action: string) {
    this.kneelTarget = action === 'kneeling' || action === 'bowing' ? 1 : 0;
    this.bendTarget = action === 'bowing' ? 1 : 0;
    if (this.kneelTarget && !this.bowingTag) {
      this.bowingTag = this.makePill('đang lạy', C.jade, '#ffffff', 0, LABEL_Y);
      this.bowingTag.x = this.nameLabelWidth / 2 + 6 + this.bowingTag.width / 2;
      this.add(this.bowingTag);
    } else if (!this.kneelTarget && this.bowingTag) {
      this.bowingTag.destroy();
      this.bowingTag = undefined;
    }
  }

  /**
   * Đặt các bộ phận theo tư thế hiện tại (kneel, bend ∈ [0,1]). Khi quỳ, nhân vật quay lưng
   * về phía người xem — mặt hướng vào chùa — rồi cúi rạp về phía trước.
   */
  private applyPose() {
    const k = easeInOut(this.kneel);
    const b = easeInOut(this.bend) * k;
    // Đứng → quỳ: người thấp xuống, vạt áo xoè ra. Cúi rạp: lưng còng, thấp hơn nữa.
    const sx = lerp(1, 1.12, k) + 0.08 * b;
    const sy = lerp(1, 0.7, k) - 0.14 * b;
    for (const part of [this.robe, this.collar, this.seam]) part.setScale(sx, sy);
    this.collar.setAlpha(1 - k);
    this.seam.setAlpha(k);
    // Đầu cúi về phía trước (xa người xem) nên tụt xuống sau lưng.
    this.head.y = lerp(-50, -37, k) + 25 * b;
    this.head.setScale(1 - 0.06 * b);
    const headBehind = b > 0.45;
    if (headBehind !== this.headBehind) {
      this.headBehind = headBehind;
      if (headBehind)
        this.body_.moveTo(this.head, this.hands.length); // ngay sau tay, trước áo
      else this.body_.bringToTop(this.head);
    }
    // Hai tay vươn ra trước đặt lên thảm, ló ra hai bên vai khi cúi.
    const spread = lerp(6, 19, b);
    const handY = lerp(-24, -30, b);
    const handAlpha = Math.min(1, b * 1.6);
    this.hands[0].setPosition(-spread, handY).setAlpha(handAlpha);
    this.hands[1].setPosition(spread, handY).setAlpha(handAlpha);
    this.mat.setAlpha(k).setScale(lerp(0.6, 1, k));
    // Nhãn tên hạ theo người cho khỏi lơ lửng; ngồi theo hàng thì đặt ở mép trước thảm.
    const labelY = this.seated ? SEATED_LABEL_Y : LABEL_Y + 22 * k;
    this.nameLabel.y = labelY;
    if (this.bowingTag) this.bowingTag.y = labelY;
  }

  /** Nhãn nổi "+X phước" bay lên rồi mờ dần. */
  floatText(text: string) {
    const pill = this.makePill(text, C.gold, '#2b1b12', 0, 0);
    pill.setPosition(this.x, this.y - 112).setDepth(10_000);
    this.remove(pill);
    this.scene.add.existing(pill);
    this.scene.tweens.add({
      targets: pill,
      y: pill.y - 44,
      alpha: { from: 1, to: 0 },
      duration: 1800,
      ease: 'Sine.easeOut',
      onComplete: () => pill.destroy(),
    });
  }

  /** Bong bóng lời nguyện trên đầu trong `ms` mili giây. */
  showBubble(text: string, ms: number) {
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    const label = this.scene.add.text(0, 0, text, {
      font: '500 13px "Be Vietnam Pro", system-ui, sans-serif',
      color: '#2b1b12',
      wordWrap: { width: 200, useAdvancedWrap: true },
      maxLines: 3,
    });
    label.setOrigin(0.5);
    const w = label.width + 22;
    const h = label.height + 14;
    const bg = this.scene.add.graphics();
    bg.fillStyle(C.white, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(1, C.labelBorder).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.fillStyle(C.white, 0.97).fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 7);
    this.bubble = this.scene.add.container(0, -114 - h / 2, [bg, label]);
    this.add(this.bubble);
    this.bubbleTimer = this.scene.time.delayedCall(ms, () => {
      this.bubble?.destroy();
      this.bubble = undefined;
    });
  }

  private makePill(text: string, fill: number, color: string, x: number, y: number) {
    const label = this.scene.add.text(0, 0, text, { font: LABEL_FONT, color });
    label.setOrigin(0.5);
    const w = label.width + 22;
    const h = 24;
    const bg = this.scene.add.graphics();
    bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const pill = this.scene.add.container(x, y, [bg, label]);
    pill.setSize(w, h);
    return pill;
  }

  /** Gọi mỗi khung hình: vị trí nội suy, chiều sâu theo y, tư thế lạy, nhún nhẹ khi đi. */
  tick(now: number, dtMs: number) {
    const p = this.motion.sample(now);
    const dx = p.x - this.x;
    this.setPosition(p.x, p.y);
    this.setDepth(p.y);

    const kneelBefore = this.kneel;
    const bendBefore = this.bend;
    this.kneel = approach(this.kneel, this.kneelTarget, dtMs / KNEEL_MS);
    // Cúi xuống đúng bằng thời gian nhấn giữ → chạm thảm đúng lúc lạy được tính.
    const bendMs = this.bendTarget > this.bend ? BOW_HOLD_MS : RISE_MS;
    this.bend = approach(this.bend, this.bendTarget, dtMs / bendMs);
    if (this.kneel !== kneelBefore || this.bend !== bendBefore) this.applyPose();

    if (this.kneel > 0) {
      this.body_.y = 0;
    } else if (this.moving || Math.abs(dx) > 0.2) {
      this.walkPhase += dtMs * 0.018;
      this.body_.y = -Math.abs(Math.sin(this.walkPhase)) * 3;
    } else {
      this.body_.y *= 0.8;
    }
  }
}

/**
 * Thảm lạy đỏ viền vàng có tua, trải dài về phía chùa (lên trên màn hình); đầu xa hẹp hơn
 * cho có phối cảnh. (x, y) là chỗ người quỳ.
 */
export function drawPrayerMat(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  const far = y - 54;
  const near = y + 12;
  const wFar = 33;
  const wNear = 40;
  const V = (px: number, py: number) => new Phaser.Math.Vector2(x + px, py);
  g.fillStyle(C.red, 1).fillPoints(
    [V(-wFar, far), V(wFar, far), V(wNear, near), V(-wNear, near)],
    true,
  );
  g.lineStyle(2, C.gold, 1).strokePoints(
    [V(-wFar + 5, far + 4), V(wFar - 5, far + 4), V(wNear - 5, near - 4), V(-wNear + 5, near - 4)],
    true,
  );
  g.lineStyle(1.5, C.goldLight, 1);
  for (let dx = -28; dx <= 28; dx += 7) {
    g.lineBetween(x + dx, far - 5, x + dx, far);
    g.lineBetween(x + (dx * wNear) / wFar, near, x + (dx * wNear) / wFar, near + 5);
  }
}
