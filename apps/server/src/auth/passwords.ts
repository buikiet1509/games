import argon2 from 'argon2';
import { isCommonPassword } from './commonPasswords';

// Tham số OWASP khuyến nghị cho argon2id: m=19 MiB, t=2, p=1.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (password: string) => argon2.hash(password, OPTIONS);

// Hash giả để verify khi không tìm thấy tài khoản → thời gian phản hồi như nhau,
// tránh dò ra username/email nào tồn tại.
const dummyHash = hashPassword('dummy-password-for-timing');

export async function verifyPassword(hash: string | undefined, password: string) {
  try {
    return await argon2.verify(hash ?? (await dummyHash), password);
  } catch {
    return false;
  }
}

/** Trả về thông báo lỗi nếu mật khẩu yếu, ngược lại null. */
export function checkPasswordPolicy(password: string, username?: string): string | null {
  if (isCommonPassword(password)) return 'Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác';
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    return 'Mật khẩu không được chứa tên đăng nhập';
  }
  return null;
}
