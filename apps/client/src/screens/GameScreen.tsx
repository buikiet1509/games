import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  AREAS,
  HALL_SEATS,
  INCENSE_RANGE,
  canDo,
  mapFor,
  type AreaId,
  type PublicUser,
} from '@chua/shared';
import type Phaser from 'phaser';
import { joinArea, reconnect, type TempleRoom } from '../net/game';
import { createGame } from '../game/createGame';
import { logout } from '../auth/session';
import { LotusLogo } from '../ui/icons';
import { ArrowRightIcon, IncenseIcon, LogoutIcon } from '../ui/icons-game';
import { bindRoomToStore, merit, resetStore, showToast } from '../game/store';
import { ActionBar } from '../ui/game/ActionBar';
import { BowCard } from '../ui/game/BowCard';
import { DonationModal } from '../ui/game/DonationModal';
import { Sidebar } from '../ui/game/Sidebar';
import { Toasts } from '../ui/game/Toasts';

type Conn =
  | { status: 'connecting' }
  | { status: 'connected'; room: TempleRoom }
  | { status: 'reconnecting' }
  | { status: 'failed'; message: string };

/** Các khu đã mở (mốc 6 mở đủ 5 khu). */
const OPEN_AREAS: readonly AreaId[] = ['san-chua', 'chinh-dien'];
const CENSER = mapFor('san-chua').obstacles.find((o) => o.id === 'lu-huong')!;
/** Điểm đứng trước lư hương khi tự đi tới để thắp hương. */
const CENSER_FRONT = { x: CENSER.x, y: CENSER.y + CENSER.r + 40 };
const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
const AREA_HINT: Partial<Record<AreaId, string>> = {
  'san-chua': 'Nhấp vào sân để di chuyển · bước lên hiên để vào Chính điện',
};

/** Hàng ghế (1 = gần tượng Phật nhất) của chỗ ngồi tại vị trí (x, y) trong Chính điện. */
const seatRow = (x: number, y: number) => {
  const rows = [...new Set(HALL_SEATS.map((s) => s.y))];
  const i = HALL_SEATS.findIndex((s) => s.x === x && s.y === y);
  return i < 0 ? null : rows.indexOf(HALL_SEATS[i]!.y) + 1;
};

export function GameScreen({ user }: { user: PublicUser }) {
  const [conn, setConn] = useState<Conn>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);
  const [count, setCount] = useState(0);
  // Khu đang ở; `from` là khu vừa rời để xuất hiện ở đúng lối vào.
  const [place, setPlace] = useState<{ area: AreaId; from?: AreaId }>({ area: 'san-chua' });
  const area = place.area;
  const [dialog, setDialog] = useState<'bow' | 'donate' | null>(null);

  // Kết nối room (và kết nối lại khi rớt mạng).
  useEffect(() => {
    let disposed = false;
    let room: TempleRoom | undefined;

    let unbind = () => {};
    const attach = (r: TempleRoom) => {
      room = r;
      unbind();
      unbind = bindRoomToStore(r);
      setConn({ status: 'connected', room: r });
      const sync = () => setCount(r.state.players?.size ?? 0);
      r.onStateChange(sync);
      // Bước vào lối đi → server báo sang khu khác.
      r.onMessage('travel', ({ to }: { to: AreaId }) => {
        if (!disposed) setPlace({ area: to, from: place.area });
      });
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
    joinArea(place.area, place.from)
      .then((r) => {
        if (disposed) void r.leave();
        else attach(r);
      })
      .catch(() => {
        if (!disposed) setConn({ status: 'failed', message: 'Không vào được chùa lúc này.' });
      });

    return () => {
      disposed = true;
      unbind();
      void room?.leave(true);
    };
  }, [place, attempt]);

  useEffect(() => () => resetStore(), []);
  useEffect(() => setDialog(null), [area]); // đổi khu thì đóng hộp thoại đang mở

  const room = conn.status === 'connected' ? conn.room : undefined;
  const prayerInput = useRef<HTMLInputElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const pendingIncense = useIncenseAutoWalk(room);

  const lightIncense = () => {
    if (!room) return;
    const me = room.state.players.get(room.sessionId);
    if (me && Math.hypot(me.x - CENSER.x, me.y - CENSER.y) <= INCENSE_RANGE - 10) {
      room.send('incense');
    } else {
      // Ở xa → tự đi tới trước lư hương rồi thắp.
      room.send('move_to', CENSER_FRONT);
      pendingIncense.current = Date.now();
    }
  };

  return (
    <div class="game-layout">
      <TopBar
        user={user}
        online={count}
        area={area}
        onSelectArea={(a) => a !== area && setPlace({ area: a })}
      />
      <div class="game-body">
        <div class="stage">
          {room && <GameCanvas key={room.roomId + room.sessionId} room={room} area={area} />}
          <div class="stage-overlay">
            <div class="hud-chip">
              <strong>{areaName(area)}</strong> · {count} người tại đây
            </div>
            {area === 'chinh-dien' ? (
              <>
                <div class="hud-chip hud-hint">
                  {room && <SeatInfo room={room} />} · bấm Lạy Phật để lạy
                </div>
                <button
                  type="button"
                  class="hud-chip hud-button"
                  onClick={() => setPlace({ area: 'san-chua', from: 'chinh-dien' })}
                >
                  <ArrowRightIcon class="flip" /> Ra Sân chùa
                </button>
              </>
            ) : (
              <div class="hud-chip hud-hint">
                <ArrowRightIcon /> {AREA_HINT[area]} · WASD / phím mũi tên
              </div>
            )}
          </div>
          {room && (
            <ActionBar
              area={area}
              onIncense={lightIncense}
              onBow={() => setDialog('bow')}
              onDonate={() => setDialog('donate')}
              onBell={() => room.send('bell')}
              onPray={() => prayerInput.current?.focus()}
            />
          )}
          <Toasts />
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
                <p>
                  {conn.status === 'reconnecting'
                    ? 'Đang kết nối lại…'
                    : `Đang vào ${areaName(area)}…`}
                </p>
              )}
            </div>
          )}
        </div>
        <Sidebar
          canPray={canDo(area, 'prayer')}
          selfName={user.username}
          prayerInputRef={prayerInput}
          onPray={(text) => room?.send('prayer', { text })}
          onReport={(activityId) => room?.send('report', { activityId })}
        />
      </div>
      {room && dialog === 'bow' && <BowCard send={(t) => room.send(t)} onClose={closeDialog} />}
      {room && dialog === 'donate' && (
        <DonationModal
          balance={merit.value ?? user.merit}
          onSubmit={(msg) => room.send('donate', msg)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

/** "Bạn ngồi hàng N" — chỗ ngồi do server xếp, gần tượng Phật trước. */
function SeatInfo({ room }: { room: TempleRoom }) {
  const [row, setRow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const me = room.state.players?.get(room.sessionId);
      if (me) setRow(seatRow(me.x, me.y));
    };
    update();
    room.onStateChange(update);
    return () => room.onStateChange.remove(update);
  }, [room]);
  return <span>{row ? `Bạn ngồi hàng ${row}` : 'Đang xếp chỗ ngồi…'}</span>;
}

/**
 * Khi bấm "Thắp hương" lúc ở xa: nhân vật tự đi tới lư hương, tới nơi thì thắp.
 * Huỷ nếu sau 8 giây vẫn chưa tới (bị người chơi điều khiển đi chỗ khác).
 */
function useIncenseAutoWalk(room: TempleRoom | undefined) {
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (!room) return;
    const check = () => {
      if (pending.current === null) return;
      if (Date.now() - pending.current > 8000) {
        pending.current = null;
        showToast('Hãy đến gần lư hương để thắp hương', { tone: 'error' });
        return;
      }
      const me = room.state.players.get(room.sessionId);
      if (me && !me.moving && Math.hypot(me.x - CENSER.x, me.y - CENSER.y) <= INCENSE_RANGE) {
        pending.current = null;
        room.send('incense');
      }
    };
    room.onStateChange(check);
    return () => room.onStateChange.remove(check);
  }, [room]);
  return pending;
}

function GameCanvas({ room, area }: { room: TempleRoom; area: AreaId }) {
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
        if (!cancelled && ref.current) game = createGame(ref.current, room, area);
      });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [room, area]);
  return <div ref={ref} class="game-canvas" aria-label={areaName(area)} />;
}

function TopBar({
  user,
  online,
  area,
  onSelectArea,
}: {
  user: PublicUser;
  online: number;
  area: AreaId;
  onSelectArea: (a: AreaId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header class="topbar">
      <div class="topbar-brand">
        <LotusLogo size={34} class="brand-logo" />
        <span>Chùa An Lạc</span>
      </div>
      <nav class="area-tabs" aria-label="Khu vực">
        {AREAS.map((a) => {
          const current = a.id === area;
          const open = OPEN_AREAS.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              class="area-tab"
              aria-current={current ? 'page' : undefined}
              aria-disabled={open ? undefined : 'true'}
              title={open ? undefined : 'Sắp mở'}
              onClick={() => open && onSelectArea(a.id)}
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
          Phước <strong>{(merit.value ?? user.merit).toLocaleString('vi-VN')}</strong>
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
