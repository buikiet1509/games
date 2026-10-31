import { toasts } from '../../game/store';
import { CheckIcon } from '../icons';
import { CloseIcon } from '../icons-game';

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast-${t.tone}`}>
          <span class="toast-icon" aria-hidden="true">
            {t.tone === 'success' ? <CheckIcon size={16} /> : <CloseIcon size={14} />}
          </span>
          <span>
            {t.text}
            {t.merit ? <strong class="gold"> · +{t.merit} phước</strong> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
