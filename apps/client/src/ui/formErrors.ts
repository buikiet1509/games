import type { ZodError } from 'zod';
import { ApiError } from '../net/api';

/** Gom lỗi Zod theo tên trường (chỉ lấy lỗi đầu tiên của mỗi trường). */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    out[key] ??= issue.message;
  }
  return out;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại';
