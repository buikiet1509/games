import { useState } from 'preact/hooks';
import {
  DEDICATIONS,
  MERIT,
  PRAYER_MAX_LENGTH,
  type ClientMessage,
  type DonationTier,
} from '@chua/shared';
import { CloseIcon } from '../icons-game';
import { Modal } from './Modal';

export function DonationModal({
  balance,
  onSubmit,
  onClose,
}: {
  balance: number;
  onSubmit: (msg: ClientMessage<'donate'>) => void;
  onClose: () => void;
}) {
  const affordable = MERIT.donationTiers.filter((t) => t <= balance);
  const [amount, setAmount] = useState<DonationTier | null>(
    affordable.includes(100) ? 100 : (affordable.at(-1) ?? null),
  );
  const [dedication, setDedication] = useState<(typeof DEDICATIONS)[number]>(DEDICATIONS[0]);
  const [prayer, setPrayer] = useState('');
  const [showName, setShowName] = useState(true);

  const submit = (e: Event) => {
    e.preventDefault();
    if (!amount) return;
    onSubmit({ amount, dedication, prayer: prayer.trim() || undefined, showName });
    onClose();
  };

  return (
    <Modal labelledBy="donate-title" onClose={onClose} class="donate-card">
      <form onSubmit={submit}>
        <div class="donate-header">
          <div>
            <h2 id="donate-title" class="card-title">
              Công đức Tam Bảo
            </h2>
            <p class="card-subtitle">
              Dùng điểm phước trong game. Số dư:{' '}
              <strong>{balance.toLocaleString('vi-VN')} phước</strong>
            </p>
          </div>
          <button type="button" class="icon-button" aria-label="Đóng" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <fieldset class="tier-group">
          <legend>Chọn mức công đức</legend>
          <div class="tiers">
            {MERIT.donationTiers.map((t) => (
              <label key={t} class="tier">
                <input
                  type="radio"
                  name="amount"
                  value={t}
                  checked={amount === t}
                  disabled={t > balance}
                  onChange={() => setAmount(t)}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
          {affordable.length === 0 && (
            <p class="field-error">Bạn chưa đủ phước. Hãy thắp hương, lạy Phật để tích thêm.</p>
          )}
        </fieldset>

        <div class="field">
          <div class="field-label-row">
            <label for="dedication">Hồi hướng cho</label>
          </div>
          <select
            id="dedication"
            class="input"
            value={dedication}
            onChange={(e) => setDedication(e.currentTarget.value as (typeof DEDICATIONS)[number])}
          >
            {DEDICATIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>

        <div class="field">
          <div class="field-label-row">
            <label for="donate-prayer">Lời nguyện (tuỳ chọn)</label>
            <span class="char-count">
              {prayer.length}/{PRAYER_MAX_LENGTH}
            </span>
          </div>
          <textarea
            id="donate-prayer"
            class="input textarea"
            rows={3}
            maxLength={PRAYER_MAX_LENGTH}
            placeholder="Nguyện cho cha mẹ luôn khoẻ mạnh."
            value={prayer}
            onInput={(e) => setPrayer(e.currentTarget.value)}
          />
        </div>

        <label class="checkbox">
          <input
            type="checkbox"
            checked={showName}
            onChange={(e) => setShowName(e.currentTarget.checked)}
          />
          <span>Hiện tên tôi trên bảng công đức</span>
        </label>

        <div class="donate-actions">
          <button type="button" class="btn btn-secondary" onClick={onClose}>
            Để sau
          </button>
          <button type="submit" class="btn btn-primary" disabled={!amount}>
            {amount ? `Dâng ${amount} phước` : 'Chưa đủ phước'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
