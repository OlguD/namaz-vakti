import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../config/app-config.service.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * SMTP mailer. Without SMTP settings (local dev) messages are logged instead of
 * sent, so sign-up and password-reset flows still work end-to-end.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: Transporter;
  /** Last message per recipient; read by e2e tests only. */
  readonly outbox = new Map<string, OutgoingMail>();

  constructor(private readonly config: AppConfig) {
    const host = config.get('SMTP_HOST');
    if (host) {
      this.transport = nodemailer.createTransport({
        host,
        port: config.get('SMTP_PORT'),
        secure: config.get('SMTP_SECURE'),
        auth: config.get('SMTP_USER')
          ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') }
          : undefined,
      });
    }
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (!this.config.isProduction) {
      this.outbox.set(mail.to, mail);
    }
    if (!this.transport) {
      this.logger.log(`[mail disabled] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.config.get('MAIL_FROM'), ...mail });
  }

  async sendVerification(to: string, token: string): Promise<void> {
    const link = `${this.config.get('APP_DEEP_LINK_BASE')}verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'E-posta adresini doğrula',
      text: `Hesabını etkinleştirmek için bağlantıya dokun:\n${link}\n\nKod: ${token}\n\nBağlantı 24 saat geçerlidir.`,
      html: `<p>Hesabını etkinleştirmek için <a href="${link}">buraya dokun</a>.</p><p>Bağlantı 24 saat geçerlidir.</p>`,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.config.get('APP_DEEP_LINK_BASE')}reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Şifre sıfırlama',
      text: `Şifreni sıfırlamak için bağlantıya dokun:\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Bağlantı 1 saat geçerlidir.`,
      html: `<p>Şifreni sıfırlamak için <a href="${link}">buraya dokun</a>.</p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Bağlantı 1 saat geçerlidir.</p>`,
    });
  }
}
