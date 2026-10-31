import Phaser from 'phaser';
import { OBSTACLES, WALK_BOUNDS, WORLD } from '@chua/shared';
import { C } from './palette';
import { PlayerSprite } from './PlayerSprite';
import type { RemotePlayer, TempleRoom } from '../net/game';

const VANISH = { x: WORLD.width / 2, y: 180 };
const GROUND_TOP = 340;

/** Cảnh Chính điện: vẽ bằng Graphics (không cần asset ảnh), đồng bộ người chơi từ room. */
export class TempleScene extends Phaser.Scene {
  private room!: TempleRoom;
  private sprites = new Map<string, PlayerSprite>();
  private unsubscribers: (() => void)[] = [];
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
    Phaser.Input.Keyboard.Key
  >;
  private lastDir = { x: 0, y: 0 };

  constructor() {
    super('temple');
  }

  init(data: { room: TempleRoom }) {
    this.room = data.room;
  }

  create() {
    this.drawBackdrop();
    this.drawHall();
    this.drawGround();
    this.drawCenser();
    this.drawTree(
      OBSTACLES.find((o) => o.id === 'cay-trai')!,
      1.15,
    );
    this.drawTree(
      OBSTACLES.find((o) => o.id === 'cay-phai')!,
      0.95,
    );
    this.setupInput();
    this.bindRoom();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      this.unsubscribers = [];
    });
  }

  update(_time: number, dtMs: number) {
    const now = performance.now();
    for (const sprite of this.sprites.values()) sprite.tick(now, dtMs);
    this.sendKeyboardDirection();
  }

  // ---------- Đồng bộ với room ----------

  private bindRoom() {
    const players = this.room.state.players;
    this.unsubscribers.push(
      players.onAdd((p, id) => this.addPlayer(id, p), true),
      players.onRemove((_p, id) => {
        this.sprites.get(id)?.destroy();
        this.sprites.delete(id);
      }),
    );
  }

  private addPlayer(id: string, p: RemotePlayer) {
    const sprite = new PlayerSprite(this, {
      name: p.name,
      robeColor: p.robeColor,
      isSelf: id === this.room.sessionId,
      x: p.x,
      y: p.y,
    });
    this.sprites.set(id, sprite);
    this.unsubscribers.push(
      p.onChange(() => {
        sprite.motion.push(performance.now(), p.x, p.y);
        sprite.setMoving(p.moving);
      }),
    );
  }

  // ---------- Điều khiển ----------

  private setupInput() {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < WALK_BOUNDS.minY - 40) return; // click lên điện thì bỏ qua
      const x = Phaser.Math.Clamp(pointer.worldX, WALK_BOUNDS.minX, WALK_BOUNDS.maxX);
      const y = Phaser.Math.Clamp(pointer.worldY, WALK_BOUNDS.minY, WALK_BOUNDS.maxY);
      this.room.send('move_to', { x, y });
      this.lastDir = { x: 0, y: 0 };
      this.showClickMarker(x, y);
    });

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    // enableCapture=false: không chặn phím khi người dùng gõ vào ô nhập ở lớp UI.
    this.keys = kb.addKeys(
      { up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D },
      false,
    ) as typeof this.keys;
  }

  private sendKeyboardDirection() {
    const typing = document.activeElement?.matches('input, textarea, select, [contenteditable]');
    const k = this.keys;
    const x = typing
      ? 0
      : (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const y = typing
      ? 0
      : (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (x !== this.lastDir.x || y !== this.lastDir.y) {
      this.lastDir = { x, y };
      this.room.send('dir', { x, y });
    }
  }

  private showClickMarker(x: number, y: number) {
    const ring = this.add.ellipse(x, y, 30, 10).setStrokeStyle(2, C.gold).setDepth(1);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  // ---------- Vẽ cảnh ----------

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
    const o = OBSTACLES.find((ob) => ob.id === 'lu-huong')!;
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
      this.add
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
    }
  }

  private drawTree(o: { x: number; y: number }, size: number) {
    const g = this.add.graphics().setDepth(o.y);
    g.fillStyle(C.shadow, 0.12).fillEllipse(o.x, o.y + 6, 120 * size, 26 * size);
    g.fillStyle(C.trunk).fillRect(o.x - 10 * size, o.y - 125 * size, 20 * size, 130 * size);
    g.fillStyle(C.leaf).fillCircle(o.x, o.y - 170 * size, 84 * size);
    g.fillStyle(C.leafLight).fillCircle(o.x - 38 * size, o.y - 208 * size, 52 * size);
  }

  // ---------- Hình học ----------

  /** Đường cong mượt qua các điểm (Catmull-Rom) để fill. */
  private curve(points: [number, number][]) {
    const spline = new Phaser.Curves.Spline(points.flat());
    return spline.getPoints(64);
  }

  /** Dải mái cong: mép trên võng lên ở giữa, hai đầu hạ thấp. */
  private roofBand(x0: number, x1: number, yEdge: number, yMid: number, thickness: number) {
    const top = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x0, yEdge),
      new Phaser.Math.Vector2((x0 + x1) / 2, 2 * yMid - yEdge),
      new Phaser.Math.Vector2(x1, yEdge),
    ).getPoints(40);
    const bottom = top.map((p) => new Phaser.Math.Vector2(p.x, p.y + thickness)).reverse();
    return [...top, ...bottom];
  }

  private strokeCurl(g: Phaser.GameObjects.Graphics, x: number, y: number, side: -1 | 1) {
    const c = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x - side * 6, y + 14),
      new Phaser.Math.Vector2(x + side * 14, y + 6),
      new Phaser.Math.Vector2(x + side * 18, y - 22),
    );
    c.draw(g);
  }
}
