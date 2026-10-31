import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { restoreSession, session } from './auth/session';
import { AuthScreen } from './screens/AuthScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';

// Phaser khá nặng → chỉ tải khi đã đăng nhập, để màn đăng nhập mở nhanh.
const GameScreen = lazy(() =>
  import('./screens/GameScreen').then((m) => ({ default: m.GameScreen })),
);

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
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'signedOut') return <AuthScreen />;
  return (
    <Suspense fallback={<Splash />}>
      <GameScreen user={state.user} />
    </Suspense>
  );
}

const Splash = () => (
  <div class="splash" role="status">
    Đang mở cổng chùa…
  </div>
);
