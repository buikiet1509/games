import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ActionBar } from './ActionBar';
import { resetStore, toasts } from '../../game/store';

const handlers = () => ({
  onIncense: vi.fn(),
  onBow: vi.fn(),
  onDonate: vi.fn(),
  onBell: vi.fn(),
  onPray: vi.fn(),
});

describe('ActionBar', () => {
  afterEach(() => {
    resetStore();
    window.localStorage.clear();
  });

  it('ẩn/hiện thanh công cụ, nhớ lựa chọn cho lần sau', async () => {
    const { unmount } = render(<ActionBar area="san-chua" {...handlers()} />);
    const toggle = screen.getByRole('button', { name: 'Ẩn' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    const show = screen.getByRole('button', { name: /Hiện thanh công cụ/ });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    // Thanh đã ẩn: không focus/bấm được.
    expect(document.getElementById('action-bar')).toHaveAttribute('inert');

    unmount();
    render(<ActionBar area="san-chua" {...handlers()} />);
    expect(screen.getByRole('button', { name: /Hiện thanh công cụ/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Hiện thanh công cụ/ }));
    expect(document.getElementById('action-bar')).not.toHaveAttribute('inert');
  });

  it('đang ẩn mà hương còn hồi chiêu thì nút gọn hiện số giây', async () => {
    window.localStorage.setItem('chua:actionbar-collapsed', '1');
    const { cooldownUntil } = await import('../../game/store');
    cooldownUntil.value = { incense: Date.now() + 42_000, bell: 0 };
    render(<ActionBar area="san-chua" {...handlers()} />);
    expect(screen.getByRole('button', { name: /Hiện thanh công cụ/ })).toHaveTextContent(
      /hương (41|42)s/,
    );
  });

  it('ở Sân chùa: thắp hương được; lạy Phật thì nhắc vào Chính điện', async () => {
    const h = handlers();
    render(<ActionBar area="san-chua" {...h} />);
    await userEvent.click(screen.getByRole('button', { name: /Thắp hương/ }));
    expect(h.onIncense).toHaveBeenCalled();

    const bow = screen.getByRole('button', { name: /Lạy Phật/ });
    expect(bow).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(bow);
    expect(h.onBow).not.toHaveBeenCalled();
    expect(toasts.value.at(-1)?.text).toBe('Hãy vào Chính điện để lạy Phật');
  });

  it('trong Chính điện: lạy, công đức, cầu nguyện được; thắp hương thì nhắc ra sân', async () => {
    const h = handlers();
    render(<ActionBar area="chinh-dien" {...h} />);
    await userEvent.click(screen.getByRole('button', { name: /Lạy Phật/ }));
    await userEvent.click(screen.getByRole('button', { name: /Công đức/ }));
    await userEvent.click(screen.getByRole('button', { name: /Cầu nguyện/ }));
    expect(h.onBow).toHaveBeenCalled();
    expect(h.onDonate).toHaveBeenCalled();
    expect(h.onPray).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Thắp hương/ }));
    expect(h.onIncense).not.toHaveBeenCalled();
    expect(toasts.value.at(-1)?.text).toMatch(/ngoài Sân chùa/);
  });
});
