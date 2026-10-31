import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/** Hộp thoại có nền mờ: Esc để đóng, focus vào hộp khi mở và trả focus khi đóng. */
export function Modal({
  labelledBy,
  onClose,
  children,
  class: className = '',
}: {
  labelledBy: string;
  onClose: () => void;
  children: ComponentChildren;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input, select, textarea',
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} class={className}>
        {children}
      </div>
    </div>
  );
}
