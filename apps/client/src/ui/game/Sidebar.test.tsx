import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import type { ActivityItem } from '@chua/shared';
import { ActivityFeed, Sidebar } from './Sidebar';
import { activity } from '../../game/store';

const item = (p: Partial<ActivityItem>): ActivityItem => ({
  id: Math.random().toString(36),
  kind: 'prayer',
  at: Date.now(),
  name: 'thien_y',
  ...p,
});

describe('ActivityFeed', () => {
  it('hiển thị đúng các loại hoạt động', () => {
    render(
      <ActivityFeed
        selfName="ban"
        onReport={() => {}}
        items={[
          item({ kind: 'incense', name: 'an_nhien' }),
          item({ kind: 'bow', name: 'hoa_sen' }),
          item({ kind: 'donation', name: 'minh_tam', amount: 100 }),
          item({ kind: 'donation', name: null, amount: 50 }),
          item({ kind: 'prayer', name: 'thien_y', text: 'Nguyện gia đình bình an' }),
        ]}
      />,
    );
    expect(screen.getByText(/vừa thắp 3 nén hương/)).toHaveTextContent(
      'an_nhien vừa thắp 3 nén hương',
    );
    expect(screen.getByText(/đã lạy Phật/)).toHaveTextContent('hoa_sen đã lạy Phật (3 lạy)');
    expect(screen.getByText('100 phước')).toBeInTheDocument();
    expect(screen.getByText('Một phật tử')).toBeInTheDocument(); // công đức ẩn danh
    expect(screen.getByText('Nguyện gia đình bình an', { exact: false })).toBeInTheDocument();
  });

  it('nội dung người dùng được hiển thị dạng chữ, không chạy HTML (chống XSS)', () => {
    const { container } = render(
      <ActivityFeed
        selfName="ban"
        onReport={() => {}}
        items={[item({ text: '<img src=x onerror="alert(1)"><b>đậm</b>' })]}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('báo cáo lời nguyện của người khác, không có nút báo cáo cho lời nguyện của mình', async () => {
    const onReport = vi.fn();
    render(
      <ActivityFeed
        selfName="ban"
        onReport={onReport}
        items={[
          item({ id: 'p1', name: 'thien_y', text: 'abc' }),
          item({ id: 'p2', name: 'ban', text: 'của mình' }),
        ]}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: /Báo cáo/ });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    expect(onReport).toHaveBeenCalledWith('p1');
    expect(buttons[0]).toBeDisabled();
  });
});

describe('Sidebar (ngăn kéo trên điện thoại)', () => {
  it('thanh kéo hiện hoạt động mới nhất và báo trạng thái mở/đóng', async () => {
    activity.value = [item({ kind: 'donation', name: 'minh_tam', amount: 100 })];
    const onToggle = vi.fn();
    const props = {
      canPray: true,
      onPray: () => {},
      onReport: () => {},
      prayerInputRef: { current: null },
      selfName: 'ban',
      onToggleDrawer: onToggle,
    };
    const { rerender } = render(<Sidebar {...props} drawerOpen={false} />);
    const handle = screen.getByRole('button', { name: /Hoạt động & lời nguyện/ });
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    expect(handle).toHaveTextContent('minh_tam đã công đức 100 phước');
    await userEvent.click(handle);
    expect(onToggle).toHaveBeenCalled();

    rerender(<Sidebar {...props} drawerOpen />);
    expect(screen.getByRole('button', { name: /Hoạt động & lời nguyện/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    activity.value = [];
  });

  it('ngoài Chính điện: ô lời nguyện bị khoá và nói rõ lý do', () => {
    render(
      <Sidebar
        canPray={false}
        onPray={() => {}}
        onReport={() => {}}
        prayerInputRef={{ current: null }}
        selfName="ban"
        drawerOpen={false}
        onToggleDrawer={() => {}}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Gửi lời nguyện' });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Vào Chính điện để gửi lời nguyện');
  });
});
