import { useEffect, useRef, useState } from 'preact/hooks';
import { BOW_HOLD_MS, BOWS_REQUIRED } from '@chua/shared';
import { bowCount } from '../../game/store';
import { CloseIcon } from '../icons-game';
import { Modal } from './Modal';

type Send = (type: 'bow_start' | 'bow_complete' | 'bow_cancel' | 'bow_end') => void;

const R = 70;
const CIRC = 2 * Math.PI * R;

/** Thẻ Lạy Phật: nhấn giữ nút (chuột, chạm hoặc phím Space/Enter) đủ lâu cho mỗi lạy. */
export function BowCard({ send, onClose }: { send: Send; onClose: () => void }) {
  const [progress, setProgress] = useState(0);
  const holding = useRef<{ start: number; raf: number } | null>(null);
  const count = bowCount.value;

  // Đủ 3 lạy: giữ hiển thị một lúc rồi về 0 cho lượt sau.
  useEffect(() => {
    if (count < BOWS_REQUIRED) return;
    const t = setTimeout(() => (bowCount.value = 0), 1500);
    return () => clearTimeout(t);
  }, [count]);

  const stop = (cancelled: boolean) => {
    if (!holding.current) return;
    cancelAnimationFrame(holding.current.raf);
    holding.current = null;
    setProgress(0);
    if (cancelled) send('bow_cancel');
  };

  const start = () => {
    if (holding.current || count >= BOWS_REQUIRED) return;
    send('bow_start');
    const startAt = performance.now();
    const frame = () => {
      const p = Math.min(1, (performance.now() - startAt) / BOW_HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stop(false);
        send('bow_complete');
        return;
      }
      holding.current!.raf = requestAnimationFrame(frame);
    };
    holding.current = { start: startAt, raf: requestAnimationFrame(frame) };
  };

  // Đóng thẻ: dừng lạy dở (nếu có) và đứng dậy khỏi thảm.
  useEffect(
    () => () => {
      if (holding.current) cancelAnimationFrame(holding.current.raf);
      send('bow_end');
    },
    [],
  );

  const shown = Math.min(count, BOWS_REQUIRED);
  return (
    <Modal labelledBy="bow-title" onClose={onClose} class="bow-card">
      <button type="button" class="icon-button card-close" aria-label="Đóng" onClick={onClose}>
        <CloseIcon />
      </button>
      <h2 id="bow-title" class="card-title">
        Lạy Phật
      </h2>
      <div class="bow-figure" aria-hidden="true">
        <svg viewBox="0 0 160 160" width="160" height="160">
          <circle cx="80" cy="80" r={R} fill="var(--cream-deep)" />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="var(--gold)"
            stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray={CIRC}
            stroke-dashoffset={CIRC * (1 - Math.max(progress, shown / BOWS_REQUIRED))}
            transform="rotate(-90 80 80)"
          />
          <g transform={`translate(80 92) rotate(${progress * 18}) translate(-80 -92)`}>
            <path d="M52 100c0-16 10-26 26-26h6c8 0 12 6 12 12v14z" fill="var(--red)" />
            <circle cx="98" cy="82" r="10" fill="#ebc9a4" />
          </g>
          <path d="M44 104h74" stroke="#c9b48c" stroke-width="3" stroke-linecap="round" />
        </svg>
      </div>
      <div class="bow-dots" role="img" aria-label={`Đã lạy ${shown} trên ${BOWS_REQUIRED}`}>
        {Array.from({ length: BOWS_REQUIRED }, (_, i) => (
          <span key={i} class={i < shown ? 'on' : ''} />
        ))}
      </div>
      <p class="bow-help">Nhấn giữ nút để lạy. Mọi người trong chính điện sẽ thấy bạn đang lạy.</p>
      <button
        type="button"
        class="btn btn-primary btn-block bow-button"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          start();
        }}
        onPointerUp={() => stop(true)}
        onPointerCancel={() => stop(true)}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') stop(true);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        Nhấn giữ để lạy ({shown}/{BOWS_REQUIRED})
      </button>
    </Modal>
  );
}
