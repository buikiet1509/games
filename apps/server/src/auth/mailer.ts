import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Dev: in email ra log thay vì gửi thật. */
export class ConsoleMailer implements Mailer {
  constructor(private log: FastifyBaseLogger) {}
  async send(message: MailMessage) {
    this.log.info({ mail: message }, 'Email (mock, không gửi thật)');
  }
}

/** Test: giữ email trong bộ nhớ để kiểm tra. */
export class MemoryMailer implements Mailer {
  sent: MailMessage[] = [];
  async send(message: MailMessage) {
    this.sent.push(message);
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}
  async send(message: MailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!res.ok) throw new Error(`Resend lỗi ${res.status}`);
  }
}

/**
 * Production không cấu hình email (vd. bản miễn phí không có tên miền riêng) → null:
 * chức năng quên mật khẩu tắt. Dev/test: in email ra log.
 */
export function createMailer(config: Config, log: FastifyBaseLogger): Mailer | null {
  if (config.RESEND_API_KEY) return new ResendMailer(config.RESEND_API_KEY, config.MAIL_FROM);
  return config.NODE_ENV === 'production' ? null : new ConsoleMailer(log);
}
