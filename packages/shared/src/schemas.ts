import { z } from 'zod';
import { PRAYER_MAX_LENGTH, ROBE_COLORS } from './constants';

export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Tên đăng nhập gồm 3–20 ký tự a-z, 0-9 hoặc _');

export const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ').max(254);

export const passwordSchema = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128);

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  robeColor: z.enum(ROBE_COLORS),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
});

export const prayerSchema = z.object({
  text: z.string().trim().min(1).max(PRAYER_MAX_LENGTH),
});

/** Thông tin người chơi trả về cho client (không bao giờ chứa hash mật khẩu). */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  robeColor: string;
  merit: number;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
