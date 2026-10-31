import type { PublicUser } from '@chua/shared';
import { logout } from '../auth/session';
import { LotusLogo } from '../ui/icons';

// Màn tạm sau khi đăng nhập — mốc 4 sẽ thay bằng cảnh sân chùa (Phaser).
export function LobbyPlaceholder({ user }: { user: PublicUser }) {
  return (
    <div class="lobby">
      <div class="auth-card lobby-card">
        <LotusLogo size={48} class="lobby-logo" />
        <h2 class="card-title">Nam mô A Di Đà Phật, {user.username}</h2>
        <p class="card-subtitle">
          Bạn đang có <strong>{user.merit.toLocaleString('vi-VN')} phước</strong>. Sân chùa sẽ mở ở
          mốc tiếp theo.
        </p>
        <button type="button" class="btn btn-secondary btn-block" onClick={() => logout()}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
