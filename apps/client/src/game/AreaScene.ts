import Phaser from 'phaser';
import { PRAYER_BUBBLE_MS, mapFor, type ActivityItem, type AreaMap, type Vec } from '@chua/shared';
import { C } from './palette';
import { PlayerSprite } from './PlayerSprite';
import type { RemotePlayer, TempleRoom } from '../net/game';

/**
 * Lớp nền cho cảnh mỗi khu: đồng bộ người chơi từ room, điều khiển, hiệu ứng hoạt động.
 * Lớp con chỉ cần vẽ khung cảnh (vẽ bằng Graphics, không cần asset ảnh).
 */
export abstract class AreaScene extends Phaser.Scene {
  protected room!: TempleRoom;
  protected map!: AreaMap;
  private sprites = new Map<string, PlayerSprite>();
  private unsubscribers: (() => void)[] = [];
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
    Phaser.Input.Keyboard.Key
  >;
  private lastDir = { x: 0, y: 0 };
  protected censerSmoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(
    key: string,
    private areaId: string,
  ) {
    super(key);
  }

  init(data: { room: TempleRoom }) {
    this.room = data.room;
    this.map = mapFor(this.areaId);
  }

  /** Vẽ khung cảnh của khu. */
  protected abstract drawEnvironment(): void;

  /**
   * Click vào chỗ không đi được (vd. nhà, cửa) → điểm nên đi tới thay thế, hoặc null để bỏ qua.
   * Mặc định: kẹp vào vùng đi lại nếu click gần, bỏ qua nếu quá xa.
   */
  protected redirectClick(p: Vec): Vec | null {
    const w = this.map.walk;
    if (p.y < w.minY - 40) return null;
    return {
      x: Phaser.Math.Clamp(p.x, w.minX, w.maxX),
      y: Phaser.Math.Clamp(p.y, w.minY, w.maxY),
    };
  }

  create() {
    this.drawEnvironment();
    // Khu ngồi cố định (Chính điện): không điều khiển di chuyển.
    if (!this.map.seats) this.setupInput();
    this.bindRoom();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      this.unsubscribers = [];
    });
  }

  update(_time: number, dtMs: number) {
    const now = performance.now();
    for (const sprite of this.sprites.values()) sprite.tick(now, dtMs);
    if (!this.map.seats) this.sendKeyboardDirection();
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
      this.room.onMessage('activity', (item: ActivityItem) => this.playActivity(item)),
    );
  }

  /** Hiệu ứng trong cảnh cho hoạt động mọi người cùng thấy (lớp con thêm hiệu ứng riêng). */
  protected playActivity(item: ActivityItem) {
    const sprite = item.sessionId ? this.sprites.get(item.sessionId) : undefined;
    switch (item.kind) {
      case 'incense':
        sprite?.floatText(`+${item.amount} phước`);
        for (const e of this.censerSmoke) e.explode(6);
        break;
      case 'donation':
        sprite?.floatText(`+${item.amount} phước`);
        if (item.text) sprite?.showBubble(item.text, PRAYER_BUBBLE_MS);
        break;
      case 'prayer':
        if (item.text) sprite?.showBubble(item.text, PRAYER_BUBBLE_MS);
        break;
    }
  }

  private addPlayer(id: string, p: RemotePlayer) {
    const sprite = new PlayerSprite(this, {
      name: p.name,
      robeColor: p.robeColor,
      isSelf: id === this.room.sessionId,
      seated: Boolean(this.map.seats),
      x: p.x,
      y: p.y,
    });
    sprite.setAction(p.action); // vd. vào Chính điện là đang ngồi trên thảm
    this.sprites.set(id, sprite);
    this.unsubscribers.push(
      p.onChange(() => {
        sprite.motion.push(performance.now(), p.x, p.y);
        sprite.setMoving(p.moving);
        sprite.setAction(p.action);
      }),
    );
  }

  // ---------- Điều khiển ----------

  private setupInput() {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const target = this.redirectClick({ x: pointer.worldX, y: pointer.worldY });
      if (!target) return;
      const { x, y } = target;
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

  // ---------- Hình học ----------

  /** Đường cong mượt qua các điểm (Catmull-Rom) để fill. */
  protected curve(points: [number, number][]) {
    const spline = new Phaser.Curves.Spline(points.flat());
    return spline.getPoints(64);
  }

  /** Dải mái cong: mép trên võng lên ở giữa, hai đầu hạ thấp. */
  protected roofBand(x0: number, x1: number, yEdge: number, yMid: number, thickness: number) {
    const top = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x0, yEdge),
      new Phaser.Math.Vector2((x0 + x1) / 2, 2 * yMid - yEdge),
      new Phaser.Math.Vector2(x1, yEdge),
    ).getPoints(40);
    const bottom = top.map((p) => new Phaser.Math.Vector2(p.x, p.y + thickness)).reverse();
    return [...top, ...bottom];
  }

  protected strokeCurl(g: Phaser.GameObjects.Graphics, x: number, y: number, side: -1 | 1) {
    const c = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x - side * 6, y + 14),
      new Phaser.Math.Vector2(x + side * 14, y + 6),
      new Phaser.Math.Vector2(x + side * 18, y - 22),
    );
    c.draw(g);
  }
}
