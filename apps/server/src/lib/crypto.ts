import { createHash, randomBytes } from 'node:crypto';

/** Token ngẫu nhiên 256-bit, an toàn để đặt trong URL/cookie. */
export const randomToken = () => randomBytes(32).toString('base64url');

/** Token đã đủ entropy nên SHA-256 là đủ để lưu (không cần argon2 như mật khẩu). */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
