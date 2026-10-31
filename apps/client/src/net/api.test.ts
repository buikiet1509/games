import { beforeEach, describe, expect, it, vi } from 'vitest';

const json = (status: number, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const user = { id: 'u1', username: 'minh_tam', email: 'a@b.c', robeColor: '#8B1E1E', merit: 100 };

// Mỗi test nạp lại module để access token trong bộ nhớ không rò giữa các test.
async function loadApi() {
  vi.resetModules();
  return import('./api');
}

describe('api', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('đăng nhập lưu access token và gửi kèm ở lời gọi sau', async () => {
    const { api } = await loadApi();
    fetchMock
      .mockResolvedValueOnce(json(200, { accessToken: 'tok-1', user }))
      .mockResolvedValueOnce(json(200, { user }));

    await api.login({ identifier: 'minh_tam', password: 'x' });
    await api.me();

    const [, init] = fetchMock.mock.calls[1]!;
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('tự refresh một lần khi access token hết hạn rồi gọi lại', async () => {
    const { api } = await loadApi();
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'Phiên đăng nhập đã hết hạn' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'tok-2', user }))
      .mockResolvedValueOnce(json(200, { user }));

    await expect(api.me()).resolves.toEqual({ user });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/me',
      '/api/auth/refresh',
      '/api/me',
    ]);
  });

  it('gộp nhiều lời gọi refresh đồng thời thành một request', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValue(json(200, { accessToken: 'tok', user }));
    await Promise.all([api.refresh(), api.refresh(), api.refresh()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refresh thất bại → trả null', async () => {
    const { api } = await loadApi();
    fetchMock.mockResolvedValueOnce(json(401, { error: 'x' }));
    await expect(api.refresh()).resolves.toBeNull();
  });

  it('chuyển lỗi server thành ApiError với thông báo tiếng Việt', async () => {
    const { api, ApiError } = await loadApi();
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Sai tên đăng nhập hoặc mật khẩu' }));
    const err = await api.login({ identifier: 'a', password: 'b' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Sai tên đăng nhập hoặc mật khẩu');
  });

  it('mất mạng → thông báo dễ hiểu', async () => {
    const { api } = await loadApi();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.login({ identifier: 'a', password: 'b' })).rejects.toThrow(
      /Không kết nối được máy chủ/,
    );
  });
});
