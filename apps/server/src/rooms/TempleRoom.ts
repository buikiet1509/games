import type { IncomingMessage } from 'node:http';
import { Room, ServerError, type Client } from '@colyseus/core';
import type { PrismaClient } from '@prisma/client';
import {
  clientMessageSchemas,
  randomSpawn,
  stepMovement,
  ROOM_MAX_CLIENTS,
  TICK_RATE_HZ,
  type AreaId,
  type MoveIntent,
  type Vec,
} from '@chua/shared';
import type { AccessTokens } from '../auth/accessToken';
import { Player, TempleState } from './state';

export interface TempleRoomDeps {
  prisma: PrismaClient;
  accessTokens: AccessTokens;
}

export interface PlayerAuth {
  userId: string;
  username: string;
  robeColor: string;
}

interface Sim {
  pos: Vec;
  intent: MoveIntent;
  /** Đếm tin nhắn trong cửa sổ 1 giây để chặn spam. */
  msgCount: number;
  msgWindowStart: number;
}

const TICK_MS = 1000 / TICK_RATE_HZ;
const MAX_MESSAGES_PER_SEC = 30;
const RECONNECT_WINDOW_SEC = 20;

/**
 * Tạo lớp room cho một khu vực. Deps được bắt qua closure (không qua options
 * của room, vì options có thể bị client ghi đè).
 */
export function createTempleRoom(deps: TempleRoomDeps) {
  return class TempleRoom extends Room<TempleState> {
    maxClients = ROOM_MAX_CLIENTS;
    private sims = new Map<string, Sim>();

    /** Xác thực access token khi ghép phòng. Trả về null ⇒ Colyseus vẫn cho vào, nên phải throw. */
    static async onAuth(token: string, _req: IncomingMessage): Promise<PlayerAuth> {
      const claims = token ? await deps.accessTokens.verify(token) : null;
      if (!claims) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      const user = await deps.prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true, username: true, robeColor: true },
      });
      if (!user) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      return { userId: user.id, username: user.username, robeColor: user.robeColor };
    }

    onCreate(options: { areaId?: AreaId }) {
      this.setState(new TempleState());
      this.state.areaId = options.areaId ?? 'chinh-dien';
      this.setPatchRate(TICK_MS);
      this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);

      this.onMessage('move_to', (client, raw) => {
        const msg = this.accept(client, 'move_to', raw);
        if (msg) this.sims.get(client.sessionId)!.intent = { kind: 'target', ...msg };
      });
      this.onMessage('dir', (client, raw) => {
        const msg = this.accept(client, 'dir', raw);
        if (msg) {
          this.sims.get(client.sessionId)!.intent =
            msg.x === 0 && msg.y === 0 ? { kind: 'idle' } : { kind: 'dir', ...msg };
        }
      });
      // Bỏ qua mọi loại tin nhắn khác thay vì để Colyseus ghi log cảnh báo.
      this.onMessage('*', () => {});
    }

    onJoin(client: Client, _options: unknown, auth?: PlayerAuth) {
      if (!auth) throw new ServerError(401, 'Phiên đăng nhập đã hết hạn');
      const pos = randomSpawn();
      const player = new Player();
      player.name = auth.username;
      player.robeColor = auth.robeColor;
      player.x = Math.round(pos.x);
      player.y = Math.round(pos.y);
      this.state.players.set(client.sessionId, player);
      this.sims.set(client.sessionId, {
        pos,
        intent: { kind: 'idle' },
        msgCount: 0,
        msgWindowStart: Date.now(),
      });
    }

    async onLeave(client: Client, consented: boolean) {
      const sim = this.sims.get(client.sessionId);
      if (!consented && sim) {
        // Rớt mạng ngoài ý muốn: giữ nhân vật đứng yên chờ client nối lại.
        sim.intent = { kind: 'idle' };
        try {
          await this.allowReconnection(client, RECONNECT_WINDOW_SEC);
          return;
        } catch {
          // hết thời gian chờ → xoá như rời phòng bình thường
        }
      }
      this.state.players.delete(client.sessionId);
      this.sims.delete(client.sessionId);
    }

    /** Validate + rate limit tin nhắn; trả về dữ liệu đã parse hoặc undefined nếu bỏ qua. */
    private accept<T extends keyof typeof clientMessageSchemas>(
      client: Client,
      type: T,
      raw: unknown,
    ) {
      const sim = this.sims.get(client.sessionId);
      if (!sim) return undefined;
      const now = Date.now();
      if (now - sim.msgWindowStart >= 1000) {
        sim.msgWindowStart = now;
        sim.msgCount = 0;
      }
      if (++sim.msgCount > MAX_MESSAGES_PER_SEC) return undefined;
      const parsed = clientMessageSchemas[type].safeParse(raw);
      return parsed.success ? parsed.data : undefined;
    }

    private tick(dtMs: number) {
      const dt = Math.min(dtMs, 250) / 1000; // chặn bước quá lớn khi event loop bị nghẽn
      for (const [sessionId, sim] of this.sims) {
        if (sim.intent.kind === 'idle') continue;
        const r = stepMovement(sim.pos, sim.intent, dt);
        sim.pos = r.pos;
        sim.intent = r.intent;
        const player = this.state.players.get(sessionId)!;
        player.x = Math.round(r.pos.x);
        player.y = Math.round(r.pos.y);
        player.moving = r.moving;
      }
      for (const [sessionId, sim] of this.sims) {
        if (sim.intent.kind === 'idle') this.state.players.get(sessionId)!.moving = false;
      }
    }
  };
}
