import { useState } from 'preact/hooks';
import { loginSchema, registerSchema, ROBE_COLORS, forgotPasswordSchema } from '@chua/shared';
import { AuthLayout } from '../ui/AuthLayout';
import { FormAlert, PasswordField, TextField } from '../ui/fields';
import { ArrowLeftIcon, CheckIcon, GoogleIcon } from '../ui/icons';
import { errorMessage, fieldErrors } from '../ui/formErrors';
import { login, register } from '../auth/session';
import { api } from '../net/api';

type View = 'login' | 'register' | 'forgot';

const ROBE_NAMES: Record<(typeof ROBE_COLORS)[number], string> = {
  '#8B1E1E': 'Đỏ son',
  '#8A5A12': 'Nâu vàng',
  '#2F6B5A': 'Xanh ngọc',
  '#4F6A9A': 'Lam',
  '#7A6A55': 'Nâu xám',
  '#6B3B6B': 'Tím',
};

export function AuthScreen() {
  const [view, setView] = useState<View>('login');

  return (
    <AuthLayout>
      {view === 'forgot' ? (
        <ForgotForm onBack={() => setView('login')} />
      ) : (
        <>
          <div class="tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
            {(['login', 'register'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                id={`tab-${v}`}
                aria-selected={view === v}
                aria-controls={`panel-${v}`}
                class="tab"
                onClick={() => setView(v)}
              >
                {v === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
            {view === 'login' ? <LoginForm onForgot={() => setView('forgot')} /> : <RegisterForm />}
          </div>
        </>
      )}
    </AuthLayout>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const parsed = loginSchema.safeParse({
      identifier: form.get('identifier'),
      password: form.get('password'),
      remember: form.get('remember') === 'on',
    });
    if (!parsed.success) {
      setErrors({
        identifier: parsed.error.issues.some((i) => i.path[0] === 'identifier')
          ? 'Vui lòng nhập tên đăng nhập hoặc email'
          : '',
        password: parsed.error.issues.some((i) => i.path[0] === 'password')
          ? 'Vui lòng nhập mật khẩu'
          : '',
      });
      return;
    }
    setErrors({});
    setAlert(null);
    setBusy(true);
    try {
      await login(parsed.data);
    } catch (err) {
      setAlert(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 class="card-title">Chào mừng trở lại</h2>
      <p class="card-subtitle">Đăng nhập để vào sân chùa cùng mọi người.</p>
      <FormAlert message={alert} />
      <TextField
        id="login-identifier"
        name="identifier"
        label="Tên đăng nhập hoặc email"
        placeholder="vd: minhtam"
        autocomplete="username"
        autocapitalize="none"
        spellcheck={false}
        error={errors.identifier || undefined}
      />
      <PasswordField
        id="login-password"
        name="password"
        label="Mật khẩu"
        autocomplete="current-password"
        error={errors.password || undefined}
        aside={
          <button type="button" class="link-button" onClick={onForgot}>
            Quên mật khẩu?
          </button>
        }
      />
      <label class="checkbox">
        <input type="checkbox" name="remember" />
        <span>Ghi nhớ đăng nhập trên thiết bị này</span>
      </label>
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Đang vào chùa…' : 'Vào chùa'}
      </button>
      <GoogleButton />
    </form>
  );
}

function RegisterForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const parsed = registerSchema.safeParse({
      username: form.get('username'),
      email: form.get('email'),
      password: form.get('password'),
      robeColor: form.get('robeColor'),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setAlert(null);
    setBusy(true);
    try {
      await register(parsed.data);
    } catch (err) {
      setAlert(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 class="card-title">Tạo tài khoản mới</h2>
      <p class="card-subtitle">Chọn tên và màu áo để mọi người nhận ra bạn trong sân chùa.</p>
      <FormAlert message={alert} />
      <TextField
        id="reg-username"
        name="username"
        label="Tên đăng nhập"
        placeholder="vd: minhtam"
        autocomplete="username"
        autocapitalize="none"
        spellcheck={false}
        maxLength={20}
        error={errors.username}
      />
      <TextField
        id="reg-email"
        name="email"
        type="email"
        label="Email"
        placeholder="ban@example.com"
        autocomplete="email"
        error={errors.email}
      />
      <PasswordField
        id="reg-password"
        name="password"
        label="Mật khẩu"
        autocomplete="new-password"
        placeholder="Tối thiểu 8 ký tự"
        error={errors.password}
      />
      <fieldset class="robe-picker">
        <legend>Màu áo</legend>
        <div class="robe-options">
          {ROBE_COLORS.map((color, i) => (
            <label key={color} class="robe-option" title={ROBE_NAMES[color]}>
              <input
                type="radio"
                name="robeColor"
                value={color}
                defaultChecked={i === 0}
                aria-label={ROBE_NAMES[color]}
              />
              <span class="robe-swatch" style={{ background: color }}>
                <CheckIcon size={18} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản và vào chùa'}
      </button>
      <GoogleButton />
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string>();
  const [alert, setAlert] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const parsed = forgotPasswordSchema.safeParse({ email: form.get('email') });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setAlert(null);
    setBusy(true);
    try {
      setSent((await api.forgotPassword(parsed.data.email)).message);
    } catch (err) {
      setAlert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" class="link-button back-link" onClick={onBack}>
        <ArrowLeftIcon size={18} /> Quay lại đăng nhập
      </button>
      <h2 class="card-title">Quên mật khẩu</h2>
      {sent ? (
        <p class="form-success" role="status">
          {sent} Liên kết có hiệu lực trong 30 phút.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <p class="card-subtitle">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại.</p>
          <FormAlert message={alert} />
          <TextField
            id="forgot-email"
            name="email"
            type="email"
            label="Email"
            autocomplete="email"
            error={error}
          />
          <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleButton() {
  return (
    <>
      <div class="divider">
        <span>hoặc</span>
      </div>
      {/* Google OAuth là mốc tuỳ chọn sau; nút hiển thị theo thiết kế nhưng chưa bật. */}
      <button
        type="button"
        class="btn btn-secondary btn-block"
        aria-disabled="true"
        title="Sắp ra mắt"
        onClick={(e) => e.preventDefault()}
      >
        <GoogleIcon size={18} /> Tiếp tục với Google
        <span class="soon-badge">Sắp có</span>
      </button>
    </>
  );
}
