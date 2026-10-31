import { useEffect, useRef, useState } from 'preact/hooks';
import { AREAS, type PublicUser } from '@chua/shared';
import type Phaser from 'phaser';
import { joinArea, reconnect, type TempleRoom } from '../net/game';
import { createGame } from '../game/createGame';
import { logout } from '../auth/session';
import { LotusLogo } from '../ui/icons';
import { ArrowRightIcon, IncenseIcon, LogoutIcon } from '../ui/icons-game';

type Conn =
  | { status: 'connecting' }
  | { status: 'connected'; room: TempleRoom }
  | { status: 'reconnecting' }
  | { status: 'failed'; message: string };

const CURRENT_AREA = 'chinh-dien' as const;
const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;

export function GameScreen({ user }: { user: PublicUser }) {
  const [conn, setConn] = useState<Conn>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);
  const [count, setCount] = useState(0);

  // Kết nối room (và kết nối lại khi rớt mạng).
  useEffect(() => {
    let disposed = false;
    let room: TempleRoom | undefined;

    const attach = (r: TempleRoom) => {
      room = r;
      setConn({ status: 'connected', room: r });
      const sync = () => setCount(r.state.players?.size ?? 0);
      r.onStateChange(sync);
      r.onLeave(async (code) => {
        if (disposed || code === 1000 || code === 4000) return; // chủ động rời
        setConn({ status: 'reconnecting' });
        for (let i = 0; i < 5 && !disposed; i++) {
          try {
            attach(await reconnect(r.reconnectionToken));
            return;
          } catch {
            await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
          }
        }
        if (!disposed) setConn({ status: 'failed', message: 'Mất kết nối với chùa.' });
      });
    };

    setConn({ status: 'connecting' });
    joinArea(CURRENT_AREA)
      .then((r) => {
        if (disposed) void r.leave();
        else attach(r);
      })
      .catch(() => {
        if (!disposed) setConn({ status: 'failed', message: 'Không vào được chùa lúc này.' });
      });

    return () => {
      disposed = true;
      void room?.leave(true);
    };
  }, [attempt]);

  const room = conn.status === 'connected' ? conn.room : undefined;

  return (
    <div class="game-layout">
      <TopBar user={user} online={count} />
      <div class="stage">
        {room && <GameCanvas key={room.roomId + room.sessionId} room={room} />}
        <div class="stage-overlay">
          <div class="hud-chip">
            <strong>{areaName(CURRENT_AREA)}</strong> · {count} người tại đây
          </div>
          <div class="hud-chip hud-hint">
            <ArrowRightIcon /> Nhấp vào sân để di chuyển · WASD / phím mũi tên
          </div>
        </div>
        {conn.status !== 'connected' && (
          <div class="stage-status" role="status">
            {conn.status === 'failed' ? (
              <>
                <p>{conn.message}</p>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Vào lại
                </button>
              </>
            ) : (
              <p>{conn.status === 'reconnecting' ? 'Đang kết nối lại…' : 'Đang vào chùa…'}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GameCanvas({ room }: { room: TempleRoom }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;
    // Chờ font tải xong để nhãn tên trong canvas dùng đúng Be Vietnam Pro / Noto Serif.
    void Promise.all([
      document.fonts.load('600 13px "Be Vietnam Pro"'),
      document.fonts.load('700 19px "Noto Serif"'),
    ])
      .catch(() => {})
      .then(() => {
        if (!cancelled && ref.current) game = createGame(ref.current, room);
      });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [room]);
  return <div ref={ref} class="game-canvas" aria-label="Sân chùa" />;
}

function TopBar({ user, online }: { user: PublicUser; online: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header class="topbar">
      <div class="topbar-brand">
        <LotusLogo size={34} class="brand-logo" />
        <span>Chùa An Lạc</span>
      </div>
      <nav class="area-tabs" aria-label="Khu vực">
        {AREAS.map((a) => {
          const current = a.id === CURRENT_AREA;
          return (
            <button
              key={a.id}
              type="button"
              class="area-tab"
              aria-current={current ? 'page' : undefined}
              aria-disabled={current ? undefined : 'true'}
              title={current ? undefined : 'Sắp mở'}
            >
              {a.name}
            </button>
          );
        })}
      </nav>
      <div class="topbar-right">
        <span class="online">
          <span class="online-dot" aria-hidden="true" />
          <strong>{online.toLocaleString('vi-VN')}</strong> phật tử đang ở chùa
        </span>
        <span class="merit-pill">
          <IncenseIcon />
          Phước <strong>{user.merit.toLocaleString('vi-VN')}</strong>
        </span>
        <div class="account">
          <button
            type="button"
            class="avatar"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Tài khoản ${user.username}`}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {user.username[0]!.toUpperCase()}
          </button>
          {menuOpen && (
            <div class="account-menu" role="menu">
              <p class="account-name">{user.username}</p>
              <button type="button" role="menuitem" onClick={() => void logout()}>
                <LogoutIcon /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
