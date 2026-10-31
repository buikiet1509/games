import { describe, expect, it } from 'vitest';
import { registerSchema, prayerSchema } from './schemas';

describe('registerSchema', () => {
  const valid = {
    username: 'minh_tam',
    email: 'mt@example.com',
    password: 'sen-no-hoa-2026',
    robeColor: '#8B1E1E',
  };

  it('chấp nhận dữ liệu hợp lệ', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['ab', 'MinhTam', 'minh tam', 'a'.repeat(21)])('từ chối username "%s"', (username) => {
    expect(registerSchema.safeParse({ ...valid, username }).success).toBe(false);
  });

  it('từ chối mật khẩu ngắn hơn 8 ký tự', () => {
    expect(registerSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
  });
});

describe('prayerSchema', () => {
  it('giới hạn 200 ký tự', () => {
    expect(prayerSchema.safeParse({ text: 'a'.repeat(200) }).success).toBe(true);
    expect(prayerSchema.safeParse({ text: 'a'.repeat(201) }).success).toBe(false);
  });
  it('từ chối chuỗi rỗng sau khi trim', () => {
    expect(prayerSchema.safeParse({ text: '   ' }).success).toBe(false);
  });
});
