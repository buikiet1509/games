import { Client, type Room } from 'colyseus.js';
import type { AreaId } from '@chua/shared';
import { API_URL, api, getAccessToken } from './api';

// Game server chạy chung với API:
// - API ở địa chỉ riêng (VITE_API_URL) → cùng địa chỉ đó (https → wss);
// - production cùng địa chỉ với trang (server phục vụ luôn trang web) → chính trang này;
// - dev: kết nối thẳng cổng 2567. VITE_GAME_URL để ghi đè nếu cần.
const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
const GAME_URL =
  import.meta.env.VITE_GAME_URL ??
  (API_URL
    ? API_URL.replace(/^http/, 'ws')
    : import.meta.env.DEV
      ? `${wsScheme}://${location.hostname}:2567`
      : `${wsScheme}://${location.host}`);

export interface RemotePlayer {
  name: string;
  robeColor: string;
  x: number;
  y: number;
  moving: boolean;
  action: string;
  onChange(cb: () => void): () => void;
}

export interface TempleStateView {
  areaId: string;
  /** Số bản sao của khu (Khu 1, 2…). */
  zone: number;
  players: {
    size: number;
    get(id: string): RemotePlayer | undefined;
    forEach(cb: (p: RemotePlayer, id: string) => void): void;
    onAdd(cb: (p: RemotePlayer, id: string) => void, triggerAll?: boolean): () => void;
    onRemove(cb: (p: RemotePlayer, id: string) => void): () => void;
  };
}

export type TempleRoom = Room<TempleStateView>;

const isAuthError = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 401;

/** Vào một khu vực (`from`: khu vừa rời, để đứng ở đúng lối vào). Token hết hạn → refresh rồi thử lại. */
export async function joinArea(areaId: AreaId, from?: AreaId): Promise<TempleRoom> {
  const attempt = () => {
    const client = new Client(GAME_URL);
    client.auth.token = getAccessToken() ?? '';
    return client.joinOrCreate<TempleStateView>(areaId, from ? { from } : {});
  };
  try {
    return await attempt();
  } catch (err) {
    if (!isAuthError(err) || !(await api.refresh())) throw err;
    return attempt();
  }
}

/** Nối lại sau khi rớt mạng (server giữ chỗ 20 giây). */
export function reconnect(token: string): Promise<TempleRoom> {
  return new Client(GAME_URL).reconnect<TempleStateView>(token);
}
