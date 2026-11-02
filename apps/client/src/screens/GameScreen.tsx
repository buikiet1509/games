import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  AREAS,
  HALL_SEATS,
  INCENSE_RANGE,
  START_AREA,
  canDo,
  mapFor,
  type AreaId,
  type PublicUser,
} from '@chua/shared';
import type Phaser from 'phaser';
import { joinArea, reconnect, type TempleRoom } from '../net/game';
import { api } from '../net/api';
import { createGame } from '../game/createGame';
import { logout } from '../auth/session';
import { LotusLogo } from '../ui/icons';
import {
  ArrowRightIcon,
  IncenseIcon,
  LogoutIcon,
  SoundOffIcon,
  SoundOnIcon,
} from '../ui/icons-game';
import {
  audioReady,
  muted,
  playBell,
  playWoodBlock,
  setAmbience,
  setMuted,
  unlockAudio,
} from '../audio/sound';
import { bindRoomToStore, merit, resetStore, showToast } from '../game/store';
import { ActionBar } from '../ui/game/ActionBar';
import { BowCard } from '../ui/game/BowCard';
import { DonationModal } from '../ui/game/DonationModal';
import { DRAWER_QUERY, Sidebar } from '../ui/game/Sidebar';
import { Toasts } from '../ui/game/Toasts';

type Conn =
  | { status: 'connecting' }
  | { status: 'connected'; room: TempleRoom }
  | { status: 'reconnecting' }
  | { status: 'failed'; message: string };

const CENSER = mapFor('san-chua').obstacles.find((o) => o.id === 'lu-huong')!;
/** Điểm đứng trước lư hương khi tự đi tới để thắp hương. */
const CENSER_FRONT = { x: CENSER.x, y: CENSER.y + CENSER.r + 40 };
const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
const AREA_HINT: Partial<Record<AreaId, string>> = {
  'cong-tam-quan': 'Nhấp để di chuyển · đi qua cổng để vào Sân chùa',
  'san-chua': 'Nhấp vào sân để di chuyển · bước lên hiên để vào Chính điện',
  'ho-sen': 'Nhấp để dạo quanh hồ · đi về bên phải để ra Sân chùa',
  'gac-chuong': 'Nhấp để di chuyển · bấm Thỉnh chuông để cả khu cùng nghe',
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
  const [place, setPlace] = useState<{ area: AreaId; from?: AreaId }>({ area: START_AREA });
  const [zone, setZone] = useState(1);
  const online = useOnlineTotal();
  const area = place.area;
  const [dialog, setDialog] = useState<'bow' | 'donate' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      const sync = () => {
        setCount(r.state.players?.size ?? 0);
        setZone(r.state.zone ?? 1);
      };
      r.onStateChange(sync);
      // Âm thanh: tiếng chuông cho cả khu, tiếng mõ mỗi khi mình lạy được một lạy.
      r.onMessage('activity', (item: { kind: string }) => item.kind === 'bell' && playBell());
      r.onMessage('bow_progress', () => playWoodBlock());
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

  useEffect(() => {
    setAmbience(area);
    return () => setAmbience(null);
  }, [area]);
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
        online={online ?? count}
        area={area}
        onSelectArea={(a) => a !== area && setPlace({ area: a })}
      />
      <div class="game-body">
        <div class="stage">
          {room && <GameCanvas key={room.roomId + room.sessionId} room={room} area={area} />}
          <div class="stage-overlay">
            <div class="hud-chip">
              <strong>
                {areaName(area)}
                {zone > 1 && ` · Khu ${zone}`}
              </strong>{' '}
              · {count} người tại đây
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
              onPray={() => {
                // Điện thoại: mở ngăn kéo rồi mới focus ô lời nguyện (chờ hiệu ứng trượt).
                if (matchMedia(DRAWER_QUERY).matches && !drawerOpen) {
                  setDrawerOpen(true);
                  setTimeout(() => prayerInput.current?.focus(), 260);
                } else prayerInput.current?.focus();
              }}
            />
          )}
          <Toasts />
          {!muted.value && !audioReady.value && (
            // Trình duyệt còn khoá âm thanh (vd. vào lại bằng phiên đã lưu, chưa bấm gì).
            <button type="button" class="audio-hint" onClick={() => unlockAudio()}>
              <SoundOnIcon size={18} /> Chạm để bật âm thanh
            </button>
          )}
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
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
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

/** Tổng số người đang ở chùa (mọi khu, mọi bản sao), lấy định kỳ từ server. */
function useOnlineTotal() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .online()
        .then((d) => alive && setTotal(d.total))
        .catch(() => {});
    void load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return total;
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
          return (
            <button
              key={a.id}
              type="button"
              class="area-tab"
              aria-current={current ? 'page' : undefined}
              onClick={() => onSelectArea(a.id)}
            >
              {a.name}
            </button>
          );
        })}
      </nav>
      <div class="topbar-right">
        <span class="online" title={`${online.toLocaleString('vi-VN')} phật tử đang ở chùa`}>
          <span class="online-dot" aria-hidden="true" />
          <strong>{online.toLocaleString('vi-VN')}</strong>
          <span class="online-label"> phật tử đang ở chùa</span>
        </span>
        <span class="merit-pill">
          <IncenseIcon />
          {/* key đổi theo số dư → chạy lại hiệu ứng "nảy" mỗi khi phước thay đổi */}
          Phước{' '}
          <strong key={merit.value ?? user.merit} class="merit-value">
            {(merit.value ?? user.merit).toLocaleString('vi-VN')}
          </strong>
        </span>
        <button
          type="button"
          class="sound-toggle"
          aria-pressed={!muted.value}
          aria-label={muted.value ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={muted.value ? 'Bật âm thanh' : 'Tắt âm thanh'}
          onClick={() => setMuted(!muted.value)}
        >
          {muted.value ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
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
