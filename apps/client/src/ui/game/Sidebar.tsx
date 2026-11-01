import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ref } from 'preact';
import { PRAYER_MAX_LENGTH, type ActivityItem } from '@chua/shared';
import { activity, leaderboard } from '../../game/store';
import { ChevronUpIcon, FlagIcon, SendIcon } from '../icons-game';

/** Màn hình hẹp (điện thoại): cột phải thành ngăn kéo trượt lên từ đáy. */
export const DRAWER_QUERY = '(max-width: 900px)';

export function useMediaQuery(query: string) {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function Sidebar({
  canPray,
  onPray,
  onReport,
  prayerInputRef,
  selfName,
  drawerOpen,
  onToggleDrawer,
}: {
  canPray: boolean;
  onPray: (text: string) => void;
  onReport: (activityId: string) => void;
  prayerInputRef: Ref<HTMLInputElement>;
  selfName: string;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const isDrawer = useMediaQuery(DRAWER_QUERY);
  const latest = activity.value.at(-1);
  return (
    <aside
      class={`sidebar${drawerOpen ? ' drawer-open' : ''}`}
      aria-label="Bảng công đức và hoạt động"
    >
      <button
        type="button"
        class="drawer-handle"
        aria-expanded={drawerOpen}
        aria-controls="sidebar-content"
        onClick={onToggleDrawer}
      >
        <span class="drawer-grip" aria-hidden="true" />
        <span class="drawer-label">
          <strong>Hoạt động & lời nguyện</strong>
          {!drawerOpen && latest && <span class="drawer-latest">{summary(latest)}</span>}
        </span>
        <ChevronUpIcon class="drawer-chevron" />
      </button>
      {/* Ngăn kéo đang đóng: nội dung khuất màn hình, không cho focus bằng phím Tab. */}
      <div id="sidebar-content" class="sidebar-content" inert={isDrawer && !drawerOpen}>
        <Leaderboard />
        <section class="feed-section" aria-labelledby="feed-title">
          <h3 id="feed-title" class="section-title">
            Hoạt động & lời nguyện
          </h3>
          <ActivityFeed items={activity.value} onReport={onReport} selfName={selfName} />
        </section>
        <PrayerInput onPray={onPray} inputRef={prayerInputRef} enabled={canPray} />
      </div>
    </aside>
  );
}

/** Một dòng tóm tắt hoạt động mới nhất cho thanh ngăn kéo khi đóng. */
function summary(item: ActivityItem) {
  const name = item.name ?? 'Một phật tử';
  switch (item.kind) {
    case 'incense':
      return `${name} vừa thắp hương`;
    case 'bow':
      return `${name} đã lạy Phật`;
    case 'donation':
      return `${name} đã công đức ${item.amount} phước`;
    case 'prayer':
      return `${name}: ${item.text}`;
    case 'bell':
      return 'Tiếng chuông chùa vang lên';
  }
}

function Leaderboard() {
  const entries = leaderboard.value;
  return (
    <section class="leaderboard" aria-labelledby="lb-title">
      <h2 id="lb-title" class="sidebar-title">
        Bảng công đức hôm nay
      </h2>
      {entries.length === 0 ? (
        <p class="empty">Chưa có ai công đức hôm nay. Hãy là người đầu tiên.</p>
      ) : (
        <ol class="lb-list">
          {entries.map((e) => (
            <li key={e.rank} class={`lb-row${e.rank === 1 ? ' lb-first' : ''}`}>
              <span class="lb-rank" aria-label={`Hạng ${e.rank}`}>
                {e.rank}
              </span>
              <span class="lb-name">{e.name}</span>
              <span class="lb-score">{e.score.toLocaleString('vi-VN')}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const time = (at: number) =>
  new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Luồng hoạt động. Mọi nội dung người dùng được render dạng text (Preact tự escape). */
export function ActivityFeed({
  items,
  onReport,
  selfName,
}: {
  items: ActivityItem[];
  onReport: (id: string) => void;
  selfName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Tự cuộn xuống tin mới, trừ khi người dùng đang cuộn lên đọc tin cũ.
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  if (items.length === 0) {
    return <p class="empty">Sân chùa đang yên tĩnh. Hãy thắp một nén hương.</p>;
  }
  return (
    <div
      ref={ref}
      class="feed"
      role="log"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {items.map((item) => (
        <FeedItem key={item.id} item={item} onReport={onReport} selfName={selfName} />
      ))}
    </div>
  );
}

function FeedItem({
  item,
  onReport,
  selfName,
}: {
  item: ActivityItem;
  onReport: (id: string) => void;
  selfName: string;
}) {
  const name = item.name ?? 'Một phật tử';
  const reportable = Boolean(item.text) && item.name !== null && item.name !== selfName;
  switch (item.kind) {
    case 'incense':
      return (
        <p class="feed-line">
          <strong>{name}</strong> vừa thắp 3 nén hương
        </p>
      );
    case 'bow':
      return (
        <p class="feed-line">
          <strong>{name}</strong> đã lạy Phật (3 lạy)
        </p>
      );
    case 'bell':
      return <p class="feed-muted">Tiếng chuông chùa vang lên · {time(item.at)}</p>;
    case 'donation':
      return (
        <div>
          <p class="feed-line">
            <strong>{name}</strong> đã công đức{' '}
            <strong class="gold">{item.amount?.toLocaleString('vi-VN')} phước</strong>
          </p>
          {item.text && (
            <PrayerCard
              id={item.id}
              name={name}
              text={item.text}
              reportable={reportable}
              onReport={onReport}
            />
          )}
        </div>
      );
    case 'prayer':
      return (
        <PrayerCard
          id={item.id}
          name={name}
          text={item.text ?? ''}
          reportable={reportable}
          onReport={onReport}
        />
      );
  }
}

function PrayerCard(props: {
  id: string;
  name: string;
  text: string;
  reportable: boolean;
  onReport: (id: string) => void;
}) {
  const [reported, setReported] = useState(false);
  return (
    <div class="prayer-card">
      <p>
        <strong>{props.name}:</strong> {props.text}
      </p>
      {props.reportable && (
        <button
          type="button"
          class="report-button"
          aria-label={`Báo cáo lời nguyện của ${props.name}`}
          title="Báo cáo nội dung không phù hợp"
          disabled={reported}
          onClick={() => {
            setReported(true);
            props.onReport(props.id);
          }}
        >
          <FlagIcon />
        </button>
      )}
    </div>
  );
}

function PrayerInput({
  onPray,
  inputRef,
  enabled,
}: {
  onPray: (t: string) => void;
  inputRef: Ref<HTMLInputElement>;
  /** Chỉ gửi lời nguyện được trong Chính điện. */
  enabled: boolean;
}) {
  const [text, setText] = useState('');
  return (
    <form
      class="prayer-form"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        onPray(t);
        setText('');
      }}
    >
      <label for="prayer-input" class="visually-hidden">
        Gửi lời nguyện
      </label>
      <input
        id="prayer-input"
        ref={inputRef}
        class="input"
        placeholder={enabled ? 'Gửi lời nguyện…' : 'Vào Chính điện để gửi lời nguyện'}
        disabled={!enabled}
        maxLength={PRAYER_MAX_LENGTH}
        autocomplete="off"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <button
        type="submit"
        class="send-button"
        aria-label="Gửi lời nguyện"
        disabled={!enabled || !text.trim()}
      >
        <SendIcon />
      </button>
    </form>
  );
}
