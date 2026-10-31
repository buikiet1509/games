import { useState } from 'preact/hooks';
import { passwordSchema } from '@chua/shared';
import { AuthLayout } from '../ui/AuthLayout';
import { FormAlert, PasswordField } from '../ui/fields';
import { errorMessage } from '../ui/formErrors';
import { api } from '../net/api';

export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const password = String(form.get('password') ?? '');
    const parsed = passwordSchema.safeParse(password);
    const next = {
      password: parsed.success ? undefined : parsed.error.issues[0]?.message,
      confirm: password === form.get('confirm') ? undefined : 'Mật khẩu nhập lại không khớp',
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setAlert(null);
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setAlert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 class="card-title">Đặt lại mật khẩu</h2>
      {done ? (
        <>
          <p class="form-success" role="status">
            Đã đổi mật khẩu. Vì an toàn, mọi thiết bị đã được đăng xuất.
          </p>
          <button type="button" class="btn btn-primary btn-block" onClick={onDone}>
            Đăng nhập
          </button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p class="card-subtitle">Chọn mật khẩu mới cho tài khoản của bạn.</p>
          <FormAlert message={alert} />
          <PasswordField
            id="reset-password"
            name="password"
            label="Mật khẩu mới"
            autocomplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            error={errors.password}
          />
          <PasswordField
            id="reset-confirm"
            name="confirm"
            label="Nhập lại mật khẩu mới"
            autocomplete="new-password"
            error={errors.confirm}
          />
          <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
