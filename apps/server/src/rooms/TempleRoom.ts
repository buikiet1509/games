import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Room, ServerError, type Client } from '@colyseus/core';
import { Prisma } from '@prisma/client';
import {
  clientMessageSchemas,
  joinOptionsSchema,
  mapFor,
  canDo,
  inRect,
  randomSpawn,
  stepMovement,
  ACTION_PLACE_HINT,
  type ActionKind,
  type AreaMap,
  BOW_HOLD_MS,
  BOWS_REQUIRED,
  COOLDOWN_MS,
  INCENSE_RANGE,
  MERIT,
  ROOM_MAX_CLIENTS,
  TICK_RATE_HZ,
  type ActivityItem,
  type AreaId,
  type ClientMessage,
  type ClientMessageType,
  type MoveIntent,
  type ServerMessages,
  type Vec,
} from '@chua/shared';
import type { GameServices } from '../services';
import { tryCooldown, cooldownRemaining } from '../services/cooldown';
import { LEADERBOARD_CHANNEL } from '../services/leaderboard';
import { Player, TempleState } from './state';

export interface PlayerAuth {
  userId: string;
  username: string;
  robeColor: string;
}

interface Sim {
  sessionId: string;
  auth: PlayerAuth;
  pos: Vec;
  intent: MoveIntent;
  bowCount: number;
  /** Thời điểm bắt đầu lạy hiện tại (null = không đang lạy). */
  bowMark: number | null;
  /** Đếm tin nhắn trong cửa sổ 1 giây để chặn spam. */
  msgCount: number;
  msgWindowStart: number;
  /** Đã bước vào lối sang khu khác, đang chờ client chuyển room. */
  traveling: boolean;
  /** Chỗ ngồi được xếp (khu ngồi cố định như Chính điện), null nếu đi lại tự do. */
  seat: number | null;
}

const TICK_MS = 1000 / TICK_RATE_HZ;
const MAX_MESSAGES_PER_SEC = 30;
const RECONNECT_WINDOW_SEC = 20;
const ACTIVITY_HISTORY = 30;
/** Bù trễ mạng khi kiểm tra thời gian nhấn giữ của mỗi lạy. */
const BOW_TOLERANCE_MS = 200;

const secs = (ms: number) => Math.ceil(ms / 1000);

/**
 * Tạo lớp room cho một khu vực. Dịch vụ được bắt qua closure (không qua options
 * của room, vì options có thể bị client ghi đè).
 */
export function createTempleRoom(svc: GameServices) {
  return class TempleRoom extends Room<TempleState> {
    maxClients = ROOM_MAX_CLIENTS;
    private sims = new Map<string, Sim>();
    private map!: AreaMap;
    /** Chỗ ngồi đang có người: chỉ số trong map.seats → sessionId. */
    private takenSeats = new Map<number, string>();
    private activity: ActivityItem[] = [];
    /** Tác giả của các nội dung có thể bị báo cáo (lời nguyện), theo activity id. */
    private authors = new Map<string, { userId: string; text: string }>();
    private bellReadyAt = 0;
    private leaderboardTimer?: NodeJS.Timeout;
    private onLeaderboardChanged = () => this.scheduleLeaderboardBroadcast();

    /** Xác thực access token khi ghép phòng. Trả về null ⇒ Colyseus vẫn cho vào, nên phải throw. */
    static async onAuth(token: string, _req: IncomingMessage): Promise<PlayerAuth> {
      const claims = token ? await svc.accessTokens.verify(token) : null;
      if (!claims) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      const user = await svc.prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true, username: true, robeColor: true },
      });
      if (!user) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      return { userId: user.id, username: user.username, robeColor: user.robeColor };
    }

    onCreate(options: { areaId?: AreaId }) {
      this.setState(new TempleState());
      this.state.areaId = options.areaId ?? 'san-chua';
      this.map = mapFor(this.state.areaId);
      // Khu ngồi cố định: sức chứa đúng bằng số chỗ; đầy thì matchmaking tự mở room mới.
      if (this.map.seats) this.maxClients = this.map.seats.length;
      this.setPatchRate(TICK_MS);
      this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
      void this.presence.subscribe(LEADERBOARD_CHANNEL, this.onLeaderboardChanged);

      this.handle('move_to', (_c, sim, msg) => {
        if (sim.seat !== null) return; // ngồi cố định, không đi lại
        this.stopBowing(sim);
        sim.intent = { kind: 'target', x: msg.x, y: msg.y };
      });
      this.handle('dir', (_c, sim, msg) => {
        if (sim.seat !== null) return;
        if (msg.x !== 0 || msg.y !== 0) this.stopBowing(sim);
        sim.intent = msg.x === 0 && msg.y === 0 ? { kind: 'idle' } : { kind: 'dir', ...msg };
      });
      this.handle('incense', (c, sim) => this.lightIncense(c, sim));
      this.handle('bow_start', (c, sim) => this.startBow(c, sim));
      this.handle('bow_complete', (c, sim) => this.completeBow(c, sim));
      this.handle('bow_cancel', (c, sim) => {
        // Nhả nút giữa chừng: ngẩng lên nhưng vẫn quỳ trên thảm.
        sim.bowMark = null;
        if (this.player(c).action === 'bowing') this.player(c).action = 'kneeling';
      });
      this.handle('bow_end', (_c, sim) => this.stopBowing(sim));
      this.handle('donate', (c, sim, msg) => this.donate(c, sim, msg));
      this.handle('bell', (c, sim) => this.ringBell(c, sim));
      this.handle('prayer', (c, sim, msg) => this.pray(c, sim, msg));
      this.handle('report', (c, sim, msg) => this.report(c, sim, msg));
      // Bỏ qua mọi loại tin nhắn khác thay vì để Colyseus ghi log cảnh báo.
      this.onMessage('*', () => {});
    }

    async onJoin(client: Client, options: unknown, auth?: PlayerAuth) {
      if (!auth) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      // Từ khu khác sang → đứng ở lối vào tương ứng; còn lại xuất hiện ngẫu nhiên.
      const { from } = joinOptionsSchema.parse(options);
      const entrance = from ? this.map.entrances[from] : undefined;
      const seat = this.takeSeat(client.sessionId);
      const pos =
        seat !== null
          ? { ...this.map.seats![seat]! }
          : entrance
            ? { ...entrance }
            : randomSpawn(this.map);
      const player = new Player();
      player.name = auth.username;
      player.robeColor = auth.robeColor;
      player.x = Math.round(pos.x);
      player.y = Math.round(pos.y);
      if (seat !== null) player.action = 'kneeling'; // vào điện là ngồi lên thảm
      this.state.players.set(client.sessionId, player);
      this.sims.set(client.sessionId, {
        sessionId: client.sessionId,
        auth,
        pos,
        intent: { kind: 'idle' },
        bowCount: 0,
        bowMark: null,
        msgCount: 0,
        msgWindowStart: Date.now(),
        traveling: false,
        seat,
      });

      this.tell(client, 'activity_history', this.activity);
      this.tell(client, 'leaderboard', await svc.leaderboard.top('day', 3));
      const checkedIn = await svc.merit.checkIn(auth.userId);
      this.tell(client, 'merit', { merit: await svc.merit.balance(auth.userId) });
      if (checkedIn) {
        this.tell(client, 'toast', {
          text: `Điểm danh hôm nay · +${MERIT.dailyCheckIn} phước`,
          merit: MERIT.dailyCheckIn,
        });
      }
      const incenseLeft = await cooldownRemaining(svc.redis, `incense:${auth.userId}`);
      if (incenseLeft)
        this.tell(client, 'cooldown', { action: 'incense', remainingMs: incenseLeft });
      const bellLeft = this.bellReadyAt - Date.now();
      if (bellLeft > 0) this.tell(client, 'cooldown', { action: 'bell', remainingMs: bellLeft });
    }

    async onLeave(client: Client, consented: boolean) {
      const sim = this.sims.get(client.sessionId);
      if (!consented && sim) {
        // Rớt mạng ngoài ý muốn: giữ nhân vật (và chỗ ngồi) chờ client nối lại.
        sim.intent = { kind: 'idle' };
        this.stopBowing(sim);
        try {
          await this.allowReconnection(client, RECONNECT_WINDOW_SEC);
          return;
        } catch {
          // hết thời gian chờ → xoá như rời phòng bình thường
        }
      }
      if (sim?.seat != null) this.takenSeats.delete(sim.seat);
      this.state.players.delete(client.sessionId);
      this.sims.delete(client.sessionId);
    }

    /** Xếp chỗ trống gần tượng Phật nhất (danh sách seats đã sắp theo thứ tự ưu tiên). */
    private takeSeat(sessionId: string): number | null {
      const seats = this.map.seats;
      if (!seats) return null;
      for (let i = 0; i < seats.length; i++) {
        if (!this.takenSeats.has(i)) {
          this.takenSeats.set(i, sessionId);
          return i;
        }
      }
      throw new ServerError(503, 'Chính điện đã đủ chỗ'); // maxClients chặn trước, phòng hờ
    }

    onDispose() {
      clearTimeout(this.leaderboardTimer);
      this.presence.unsubscribe(LEADERBOARD_CHANNEL, this.onLeaderboardChanged);
    }

    // ---------- Hạ tầng tin nhắn ----------

    private tell<K extends keyof ServerMessages>(client: Client, type: K, data: ServerMessages[K]) {
      client.send(type, data);
    }

    private broadcastActivity(item: Omit<ActivityItem, 'id' | 'at'> & { id?: string }) {
      const full: ActivityItem = { id: randomUUID(), at: Date.now(), ...item };
      this.activity.push(full);
      if (this.activity.length > ACTIVITY_HISTORY) {
        const dropped = this.activity.shift()!;
        this.authors.delete(dropped.id);
      }
      this.broadcast('activity', full);
      return full;
    }

    private fail(client: Client, action: ClientMessageType, message: string) {
      this.tell(client, 'action_error', { action, message });
    }

    /** Hành động có được làm ở khu này không; không được thì báo nơi cần tới. */
    private allowedHere(client: Client, type: ClientMessageType, action: ActionKind) {
      if (canDo(this.state.areaId, action)) return true;
      this.fail(client, type, ACTION_PLACE_HINT[action]);
      return false;
    }

    /** Đăng ký handler: rate limit + validate Zod + bắt lỗi, rồi mới gọi logic. */
    private handle<T extends ClientMessageType>(
      type: T,
      fn: (client: Client, sim: Sim, msg: ClientMessage<T>) => void | Promise<void>,
    ) {
      this.onMessage(type, async (client, raw) => {
        const sim = this.sims.get(client.sessionId);
        if (!sim) return;
        const now = Date.now();
        if (now - sim.msgWindowStart >= 1000) {
          sim.msgWindowStart = now;
          sim.msgCount = 0;
        }
        if (++sim.msgCount > MAX_MESSAGES_PER_SEC) return;
        const parsed = clientMessageSchemas[type].safeParse(raw);
        if (!parsed.success) return;
        try {
          await fn(client, sim, parsed.data as ClientMessage<T>);
        } catch (err) {
          svc.log.error({ err, type }, 'Lỗi xử lý hành động');
          this.fail(client, type, 'Đã có lỗi xảy ra, vui lòng thử lại');
        }
      });
    }

    private player(client: Client) {
      return this.state.players.get(client.sessionId)!;
    }

    // ---------- Hành động ----------

    private async lightIncense(client: Client, sim: Sim) {
      if (!this.allowedHere(client, 'incense', 'incense')) return;
      const censer = this.map.obstacles.find((o) => o.id === 'lu-huong');
      if (!censer || Math.hypot(sim.pos.x - censer.x, sim.pos.y - censer.y) > INCENSE_RANGE) {
        return this.fail(client, 'incense', 'Hãy đến gần lư hương để thắp hương');
      }
      const wait = await tryCooldown(svc.redis, `incense:${sim.auth.userId}`, COOLDOWN_MS.incense);
      if (wait) {
        this.tell(client, 'cooldown', { action: 'incense', remainingMs: wait });
        return this.fail(client, 'incense', `Hương vừa thắp xong, chờ ${secs(wait)} giây nữa nhé`);
      }
      svc.merit.credit(sim.auth.userId, MERIT.incense);
      this.tell(client, 'cooldown', { action: 'incense', remainingMs: COOLDOWN_MS.incense });
      await this.sendBalance(client, sim);
      this.tell(client, 'toast', { text: 'Bạn đã thắp 3 nén hương', merit: MERIT.incense });
      this.broadcastActivity({
        kind: 'incense',
        name: sim.auth.username,
        sessionId: client.sessionId,
        amount: MERIT.incense,
      });
    }

    private startBow(client: Client, sim: Sim) {
      if (!this.allowedHere(client, 'bow_start', 'bow')) return;
      sim.intent = { kind: 'idle' }; // lạy thì đứng yên
      sim.bowMark = Date.now();
      const player = this.player(client);
      player.action = 'bowing';
      player.moving = false;
    }

    private async completeBow(client: Client, sim: Sim) {
      if (sim.bowMark === null || this.player(client).action !== 'bowing') return;
      const now = Date.now();
      // Client không thể "lạy nhanh" hơn thời gian nhấn giữ quy định.
      if (now - sim.bowMark < BOW_HOLD_MS - BOW_TOLERANCE_MS) return;
      sim.bowMark = null;
      sim.bowCount += 1;
      this.tell(client, 'bow_progress', { count: sim.bowCount });
      if (sim.bowCount < BOWS_REQUIRED) {
        this.player(client).action = 'kneeling'; // ngẩng lên, vẫn quỳ chờ lạy tiếp
        return;
      }

      sim.bowCount = 0;
      this.stopBowing(sim);
      const wait = await tryCooldown(svc.redis, `bow:${sim.auth.userId}`, COOLDOWN_MS.bowReward);
      if (wait) {
        this.tell(client, 'toast', { text: `Bạn đã lạy Phật đủ ${BOWS_REQUIRED} lạy` });
      } else {
        svc.merit.credit(sim.auth.userId, MERIT.bow);
        await this.sendBalance(client, sim);
        this.tell(client, 'toast', {
          text: `Bạn đã lạy Phật đủ ${BOWS_REQUIRED} lạy`,
          merit: MERIT.bow,
        });
      }
      this.broadcastActivity({ kind: 'bow', name: sim.auth.username, sessionId: client.sessionId });
    }

    /** Dừng lạy: khu ngồi cố định thì vẫn quỳ trên thảm, còn lại thì đứng dậy. */
    private stopBowing(sim: Sim) {
      sim.bowMark = null;
      const player = this.state.players.get(sim.sessionId);
      if (player) player.action = sim.seat !== null ? 'kneeling' : '';
    }

    private async donate(client: Client, sim: Sim, msg: ClientMessage<'donate'>) {
      if (!this.allowedHere(client, 'donate', 'donate')) return;
      const prayer = msg.prayer ? svc.profanity(msg.prayer).text : undefined;
      const balance = await svc.merit.spend(sim.auth.userId, msg.amount, (tx) =>
        tx.donation.create({
          data: {
            userId: sim.auth.userId,
            amount: msg.amount,
            dedication: msg.dedication,
            prayer: prayer || null,
            showName: msg.showName,
            areaId: this.state.areaId,
          },
        }),
      );
      if (balance === null)
        return this.fail(client, 'donate', 'Không đủ phước để công đức mức này');

      this.tell(client, 'merit', { merit: balance });
      this.tell(client, 'toast', { text: `Đã dâng ${msg.amount} phước · Nam mô A Di Đà Phật` });
      if (msg.showName) {
        await svc.leaderboard.add(sim.auth.userId, sim.auth.username, msg.amount);
        await this.presence.publish(LEADERBOARD_CHANNEL, Date.now());
      }
      const item = this.broadcastActivity({
        kind: 'donation',
        // Ẩn danh: không lộ tên, không gắn hiệu ứng lên nhân vật.
        name: msg.showName ? sim.auth.username : null,
        sessionId: msg.showName ? client.sessionId : undefined,
        amount: msg.amount,
        text: prayer || undefined,
      });
      if (prayer) this.authors.set(item.id, { userId: sim.auth.userId, text: prayer });
    }

    private ringBell(client: Client, sim: Sim) {
      if (!this.allowedHere(client, 'bell', 'bell')) return;
      const now = Date.now();
      if (now < this.bellReadyAt) {
        const wait = this.bellReadyAt - now;
        this.tell(client, 'cooldown', { action: 'bell', remainingMs: wait });
        return this.fail(client, 'bell', `Chuông vừa được thỉnh, chờ ${secs(wait)} giây nữa nhé`);
      }
      this.bellReadyAt = now + COOLDOWN_MS.bellPerRoom;
      this.broadcast('cooldown', { action: 'bell', remainingMs: COOLDOWN_MS.bellPerRoom });
      this.broadcastActivity({
        kind: 'bell',
        name: sim.auth.username,
        sessionId: client.sessionId,
      });
    }

    private async pray(client: Client, sim: Sim, msg: ClientMessage<'prayer'>) {
      if (!this.allowedHere(client, 'prayer', 'prayer')) return;
      const wait = await tryCooldown(svc.redis, `prayer:${sim.auth.userId}`, COOLDOWN_MS.prayer);
      if (wait) return this.fail(client, 'prayer', 'Bạn gửi hơi nhanh, chờ một chút nhé');
      const text = svc.profanity(msg.text).text;
      const id = randomUUID();
      svc.prayers.push({
        id,
        userId: sim.auth.userId,
        text,
        areaId: this.state.areaId,
        createdAt: new Date(),
      });
      this.authors.set(id, { userId: sim.auth.userId, text });
      this.broadcastActivity({
        id,
        kind: 'prayer',
        name: sim.auth.username,
        sessionId: client.sessionId,
        text,
      });
    }

    private async report(client: Client, sim: Sim, msg: ClientMessage<'report'>) {
      const target = this.authors.get(msg.activityId);
      if (!target) return this.fail(client, 'report', 'Không tìm thấy nội dung để báo cáo');
      if (target.userId === sim.auth.userId) {
        return this.fail(client, 'report', 'Không thể báo cáo nội dung của chính mình');
      }
      try {
        await svc.prisma.report.create({
          data: {
            reporterId: sim.auth.userId,
            targetUserId: target.userId,
            activityId: msg.activityId,
            text: target.text,
          },
        });
      } catch (err) {
        // Báo cáo trùng → coi như đã ghi nhận.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'))
          throw err;
      }
      this.tell(client, 'toast', { text: 'Đã gửi báo cáo. Cảm ơn bạn đã giữ chốn thanh tịnh.' });
    }

    private async sendBalance(client: Client, sim: Sim) {
      this.tell(client, 'merit', { merit: await svc.merit.balance(sim.auth.userId) });
    }

    // ---------- Bảng công đức ----------

    /** Gom nhiều thay đổi liên tiếp thành một lần gửi. */
    private scheduleLeaderboardBroadcast() {
      if (this.leaderboardTimer) return;
      this.leaderboardTimer = setTimeout(async () => {
        this.leaderboardTimer = undefined;
        try {
          this.broadcast('leaderboard', await svc.leaderboard.top('day', 3));
        } catch (err) {
          svc.log.error({ err }, 'Không lấy được bảng công đức');
        }
      }, 300);
    }

    // ---------- Mô phỏng ----------

    private tick(dtMs: number) {
      const dt = Math.min(dtMs, 250) / 1000; // chặn bước quá lớn khi event loop bị nghẽn
      for (const [sessionId, sim] of this.sims) {
        const player = this.state.players.get(sessionId);
        if (!player) continue;
        if (sim.intent.kind === 'idle') {
          player.moving = false;
          continue;
        }
        const r = stepMovement(sim.pos, sim.intent, dt, this.map);
        sim.pos = r.pos;
        sim.intent = r.intent;
        player.x = Math.round(r.pos.x);
        player.y = Math.round(r.pos.y);
        player.moving = r.moving;
        this.checkExits(sim);
      }
    }

    /** Bước vào lối đi → báo client chuyển sang khu bên kia (client tự rời room này). */
    private checkExits(sim: Sim) {
      if (sim.traveling) return;
      const exit = this.map.exits.find((e) => inRect(sim.pos, e.zone));
      if (!exit) return;
      const client = this.clients.find((c) => c.sessionId === sim.sessionId);
      if (!client) return;
      sim.traveling = true;
      sim.intent = { kind: 'idle' };
      this.tell(client, 'travel', { to: exit.to });
    }
  };
}
