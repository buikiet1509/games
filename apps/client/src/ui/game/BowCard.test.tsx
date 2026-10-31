import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/preact';
import { BOW_HOLD_MS } from '@chua/shared';
import { BowCard } from './BowCard';
import { bowCount } from '../../game/store';

describe('BowCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'],
    });
    bowCount.value = 0;
  });
  afterEach(() => vi.useRealTimers());

  const button = () => screen.getByRole('button', { name: /Nhấn giữ để lạy/ });

  it('nhấn giữ đủ lâu → bắt đầu và hoàn thành một lạy', () => {
    const send = vi.fn();
    render(<BowCard send={send} onClose={() => {}} />);
    fireEvent.pointerDown(button());
    expect(send).toHaveBeenLastCalledWith('bow_start');
    act(() => {
      vi.advanceTimersByTime(BOW_HOLD_MS + 50);
    });
    expect(send).toHaveBeenLastCalledWith('bow_complete');
    fireEvent.pointerUp(button()); // nhả sau khi xong không huỷ gì
    expect(send).not.toHaveBeenCalledWith('bow_cancel');
  });

  it('nhả sớm → huỷ, không tính lạy', () => {
    const send = vi.fn();
    render(<BowCard send={send} onClose={() => {}} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(BOW_HOLD_MS / 2);
    });
    fireEvent.pointerUp(button());
    expect(send.mock.calls.map((c) => c[0])).toEqual(['bow_start', 'bow_cancel']);
  });

  it('dùng được bằng bàn phím (giữ phím Space)', () => {
    const send = vi.fn();
    render(<BowCard send={send} onClose={() => {}} />);
    fireEvent.keyDown(button(), { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(BOW_HOLD_MS + 50);
    });
    expect(send.mock.calls.map((c) => c[0])).toEqual(['bow_start', 'bow_complete']);
  });

  it('đóng thẻ thì đứng dậy khỏi thảm', () => {
    const send = vi.fn();
    const { unmount } = render(<BowCard send={send} onClose={() => {}} />);
    unmount();
    expect(send).toHaveBeenLastCalledWith('bow_end');
  });

  it('hiển thị số lạy server đã xác nhận', () => {
    render(<BowCard send={() => {}} onClose={() => {}} />);
    act(() => {
      bowCount.value = 2;
    });
    expect(button()).toHaveTextContent('Nhấn giữ để lạy (2/3)');
    expect(screen.getByRole('img', { name: 'Đã lạy 2 trên 3' })).toBeInTheDocument();
  });
});
