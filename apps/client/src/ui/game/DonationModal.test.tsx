import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { DonationModal } from './DonationModal';

describe('DonationModal', () => {
  it('mặc định chọn 100, khoá các mức vượt số dư', () => {
    render(<DonationModal balance={120} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: '100' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '500' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dâng 100 phước' })).toBeInTheDocument();
  });

  it('gửi đúng dữ liệu đã chọn rồi đóng', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<DonationModal balance={1250} onSubmit={onSubmit} onClose={onClose} />);
    await userEvent.click(screen.getByRole('radio', { name: '500' }));
    await userEvent.selectOptions(screen.getByLabelText('Hồi hướng cho'), 'Cha mẹ khoẻ mạnh');
    await userEvent.type(screen.getByLabelText('Lời nguyện (tuỳ chọn)'), '  Nguyện cha mẹ khoẻ  ');
    await userEvent.click(screen.getByLabelText('Hiện tên tôi trên bảng công đức'));
    await userEvent.click(screen.getByRole('button', { name: 'Dâng 500 phước' }));
    expect(onSubmit).toHaveBeenCalledWith({
      amount: 500,
      dedication: 'Cha mẹ khoẻ mạnh',
      prayer: 'Nguyện cha mẹ khoẻ',
      showName: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('không đủ phước cho mức thấp nhất → không gửi được', () => {
    render(<DonationModal balance={5} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Chưa đủ phước' })).toBeDisabled();
    expect(screen.getByText(/chưa đủ phước/i, { selector: 'p' })).toBeInTheDocument();
  });

  it('Esc hoặc "Để sau" để đóng', async () => {
    const onClose = vi.fn();
    render(<DonationModal balance={100} onSubmit={() => {}} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
