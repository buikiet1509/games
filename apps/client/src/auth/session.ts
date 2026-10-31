import { signal } from '@preact/signals';
import type { LoginInput, PublicUser, RegisterInput } from '@chua/shared';
import { api } from '../net/api';

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: PublicUser };

export const session = signal<SessionState>({ status: 'loading' });

/** Khi mở trang: thử khôi phục phiên từ refresh cookie. */
export async function restoreSession() {
  const res = await api.refresh();
  session.value = res ? { status: 'signedIn', user: res.user } : { status: 'signedOut' };
}

export async function login(input: LoginInput) {
  const res = await api.login(input);
  session.value = { status: 'signedIn', user: res.user };
}

export async function register(input: RegisterInput) {
  const res = await api.register(input);
  session.value = { status: 'signedIn', user: res.user };
}

export async function logout() {
  try {
    await api.logout();
  } finally {
    session.value = { status: 'signedOut' };
  }
}
