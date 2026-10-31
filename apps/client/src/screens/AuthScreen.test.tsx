import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './AuthScreen';
import { session } from '../auth/session';
import { api, ApiError } from '../net/api';

const user = { id: 'u1', username: 'minh_tam', email: 'a@b.c', robeColor: '#8B1E1E', merit: 100 };

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    session.value = { status: 'signedOut' };
  });

  it('hiển thị đúng nội dung theo thiết kế', () => {
    render(<AuthScreen />);
    expect(
      screen.getByRole('heading', { name: 'Cùng nhau đi chùa, dù ở bất cứ đâu' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Đăng nhập' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Vào chùa' })).toBeInTheDocument();
  });

  it('nút mắt chuyển hiện/ẩn mật khẩu', async () => {
    render(<AuthScreen />);
    const input = screen.getByLabelText('Mật khẩu');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('báo lỗi khi để trống, không gọi API', async () => {
    const spy = vi.spyOn(api, 'login');
    render(<AuthScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Vào chùa' }));
    expect(screen.getByText('Vui lòng nhập tên đăng nhập hoặc email')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('đăng nhập gửi đúng dữ liệu (kể cả "ghi nhớ") và chuyển sang trạng thái đã đăng nhập', async () => {
    const spy = vi.spyOn(api, 'login').mockResolvedValue({ accessToken: 't', user });
    render(<AuthScreen />);
    await userEvent.type(screen.getByLabelText('Tên đăng nhập hoặc email'), ' Minh_Tam ');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sen-no-giua-ho');
    await userEvent.click(screen.getByLabelText('Ghi nhớ đăng nhập trên thiết bị này'));
    await userEvent.click(screen.getByRole('button', { name: 'Vào chùa' }));

    expect(spy).toHaveBeenCalledWith({
      identifier: 'minh_tam',
      password: 'sen-no-giua-ho',
      remember: true,
    });
    expect(session.value).toEqual({ status: 'signedIn', user });
  });

  it('hiển thị lỗi từ server', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new ApiError(401, 'Sai tên đăng nhập hoặc mật khẩu'));
    render(<AuthScreen />);
    await userEvent.type(screen.getByLabelText('Tên đăng nhập hoặc email'), 'minh_tam');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await userEvent.click(screen.getByRole('button', { name: 'Vào chùa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên đăng nhập hoặc mật khẩu');
    expect(screen.getByRole('button', { name: 'Vào chùa' })).toBeEnabled();
  });

  it('đăng ký: kiểm tra dữ liệu phía client theo schema dùng chung', async () => {
    const spy = vi.spyOn(api, 'register');
    render(<AuthScreen />);
    await userEvent.click(screen.getByRole('tab', { name: 'Đăng ký' }));
    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'AB');
    await userEvent.type(screen.getByLabelText('Email'), 'khong-hop-le');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'ngan');
    await userEvent.click(screen.getByRole('button', { name: /Tạo tài khoản/ }));

    expect(screen.getByText(/3–20 ký tự/)).toBeInTheDocument();
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu tối thiểu 8 ký tự')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('đăng ký gửi màu áo đã chọn', async () => {
    const spy = vi.spyOn(api, 'register').mockResolvedValue({ accessToken: 't', user });
    render(<AuthScreen />);
    await userEvent.click(screen.getByRole('tab', { name: 'Đăng ký' }));
    await userEvent.type(screen.getByLabelText('Tên đăng nhập'), 'hoa_sen');
    await userEvent.type(screen.getByLabelText('Email'), 'hoasen@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'khoi-huong-bay-cao');
    await userEvent.click(screen.getByLabelText('Xanh ngọc'));
    await userEvent.click(screen.getByRole('button', { name: /Tạo tài khoản/ }));

    expect(spy).toHaveBeenCalledWith({
      username: 'hoa_sen',
      email: 'hoasen@example.com',
      password: 'khoi-huong-bay-cao',
      robeColor: '#2F6B5A',
    });
  });

  it('quên mật khẩu hiển thị thông báo chung', async () => {
    vi.spyOn(api, 'forgotPassword').mockResolvedValue({
      message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.',
    });
    render(<AuthScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    await userEvent.type(screen.getByLabelText('Email'), 'ai@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Nếu email tồn tại/);

    await userEvent.click(screen.getByRole('button', { name: /Quay lại đăng nhập/ }));
    expect(screen.getByRole('button', { name: 'Vào chùa' })).toBeInTheDocument();
  });
});
