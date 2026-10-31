import { useEffect, useState } from 'preact/hooks';
import { restoreSession, session } from './auth/session';
import { AuthScreen } from './screens/AuthScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { LobbyPlaceholder } from './screens/LobbyPlaceholder';

const RESET_PATH = '/dat-lai-mat-khau';

export function App() {
  const [resetToken, setResetToken] = useState(() =>
    location.pathname === RESET_PATH ? new URLSearchParams(location.search).get('token') : null,
  );

  useEffect(() => {
    if (!resetToken) void restoreSession();
  }, [resetToken]);

  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          history.replaceState(null, '', '/');
          setResetToken(null);
        }}
      />
    );
  }

  const state = session.value;
  if (state.status === 'loading') {
    return (
      <div class="splash" role="status">
        Đang mở cổng chùa…
      </div>
    );
  }
  return state.status === 'signedIn' ? <LobbyPlaceholder user={state.user} /> : <AuthScreen />;
}
