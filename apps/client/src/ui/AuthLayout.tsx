import type { ComponentChildren } from 'preact';
import { LotusLogo } from './icons';
import { TamQuanGate } from './TamQuanGate';

/** Bố cục chia đôi: trái nền đỏ son + cổng Tam Quan, phải là thẻ form. */
export function AuthLayout({ children }: { children: ComponentChildren }) {
  return (
    <div class="auth-layout">
      <section class="auth-hero" aria-label="Giới thiệu">
        <div class="brand">
          <LotusLogo size={40} class="brand-logo" />
          <span class="brand-name">Chùa An Lạc Online</span>
        </div>
        <TamQuanGate />
        <div class="hero-copy">
          <h1>Cùng nhau đi chùa, dù ở bất cứ đâu</h1>
          <p>
            Thắp hương, lạy Phật, công đức và nhìn thấy những phật tử khác đang cùng có mặt trong
            sân chùa — theo thời gian thực.
          </p>
        </div>
      </section>
      <main class="auth-main">
        <div class="auth-card">{children}</div>
      </main>
    </div>
  );
}
