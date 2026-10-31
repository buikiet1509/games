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
  afterEach(resetStore);

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
