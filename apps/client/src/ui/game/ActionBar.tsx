import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { ACTION_PLACE_HINT, canDo, type ActionKind } from '@chua/shared';
import { cooldownUntil, showToast } from '../../game/store';
import { IncenseIcon } from '../icons-game';
import { BellIcon, BowIcon, DonateIcon, PrayIcon } from '../icons-game';

export interface ActionHandlers {
  onIncense: () => void;
  onBow: () => void;
  onDonate: () => void;
  onBell: () => void;
  onPray: () => void;
}

/**
 * Thanh 5 hành động ở đáy cảnh (Thắp hương nổi bật màu đỏ son). Hành động không làm được ở
 * khu hiện tại hiện mờ; bấm vào thì nhắc nơi cần tới.
 */
export function ActionBar({ area, ...h }: ActionHandlers & { area: string }) {
  const now = useNow(1000);
  const incenseLeft = Math.ceil((cooldownUntil.value.incense - now) / 1000);
  const bellLeft = Math.ceil((cooldownUntil.value.bell - now) / 1000);
  const here = (kind: ActionKind) =>
    canDo(area, kind) ? {} : { unavailable: ACTION_PLACE_HINT[kind] };

  return (
    <div class="action-bar" role="toolbar" aria-label="Hành động">
      <Action
        primary
        icon={<IncenseIcon size={22} />}
        label="Thắp hương"
        hint={incenseLeft > 0 ? `${incenseLeft}s` : undefined}
        cooling={incenseLeft > 0}
        {...here('incense')}
        onClick={h.onIncense}
      />
      <Action icon={<BowIcon />} label="Lạy Phật" {...here('bow')} onClick={h.onBow} />
      <Action icon={<DonateIcon />} label="Công đức" {...here('donate')} onClick={h.onDonate} />
      <Action
        icon={<BellIcon />}
        label="Thỉnh chuông"
        hint={canDo(area, 'bell') && bellLeft > 0 ? formatMinSec(bellLeft) : undefined}
        cooling={bellLeft > 0}
        {...here('bell')}
        onClick={h.onBell}
      />
      <Action icon={<PrayIcon />} label="Cầu nguyện" {...here('prayer')} onClick={h.onPray} />
    </div>
  );
}

function Action(props: {
  icon: JSX.Element;
  label: string;
  hint?: string;
  primary?: boolean;
  /** Đang hồi chiêu. */
  cooling?: boolean;
  /** Không làm được ở khu này — nội dung là gợi ý nơi cần tới. */
  unavailable?: string;
  onClick: () => void;
}) {
  const disabled = Boolean(props.unavailable) || props.cooling;
  return (
    <button
      type="button"
      class={`action${props.primary ? ' action-primary' : ''}`}
      // aria-disabled (không dùng disabled) để vẫn focus/bấm được và đọc được lý do.
      aria-disabled={disabled ? 'true' : undefined}
      title={props.unavailable}
      onClick={() => {
        if (props.unavailable) showToast(props.unavailable, { tone: 'error' });
        else if (!props.cooling) props.onClick();
      }}
    >
      {props.icon}
      <span>{props.label}</span>
      {props.hint && !props.unavailable && <span class="action-hint">{props.hint}</span>}
    </button>
  );
}

const formatMinSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Thời gian hiện tại, cập nhật định kỳ (để đếm ngược hồi chiêu). */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
