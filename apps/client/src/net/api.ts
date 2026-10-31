import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@chua/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Access token chỉ nằm trong bộ nhớ (không localStorage) để giảm rủi ro XSS đánh cắp.
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;

export const getAccessToken = () => accessToken;

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ, vui lòng kiểm tra mạng');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Đã có lỗi xảy ra');
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  send<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

function keep(res: AuthResponse) {
  accessToken = res.accessToken;
  return res;
}

/** Đổi refresh cookie lấy access token mới. Gộp các lời gọi đồng thời làm một. */
export function refresh(): Promise<AuthResponse | null> {
  refreshing ??= post<AuthResponse>('/api/auth/refresh')
    .then(keep)
    .catch(() => {
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Gọi API cần đăng nhập; tự refresh một lần nếu access token hết hạn. */
async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await send<T>(path, init);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    if (!(await refresh())) throw err;
    return send<T>(path, init);
  }
}

export const api = {
  register: (input: RegisterInput) => post<AuthResponse>('/api/auth/register', input).then(keep),
  login: (input: LoginInput) => post<AuthResponse>('/api/auth/login', input).then(keep),
  refresh,
  async logout() {
    try {
      await post('/api/auth/logout');
    } finally {
      accessToken = null;
    }
  },
  forgotPassword: (email: string) => post<{ message: string }>('/api/auth/forgot', { email }),
  resetPassword: (token: string, password: string) =>
    post<void>('/api/auth/reset', { token, password }),
  me: () => authed<{ user: PublicUser }>('/api/me'),
};
