import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { loadEnv } from '../config/env.js';

/**
 * SMTP sending (Gmail / Google Workspace with an app password, ukr.net, a corporate server …).
 * Configured by SMTP_URL + MAIL_FROM (Secret Manager). Without them e-mail is simply off.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly env = loadEnv();
  private transport: Transporter | null = null;

  get configured(): boolean {
    return !!(this.env.smtpUrl && this.env.mailFrom);
  }

  /** Sends one letter; recipients go to Bcc so they do not see each other's addresses. */
  async send(to: string[], subject: string, text: string): Promise<boolean> {
    const recipients = [...new Set(to.map((x) => x.trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length) return false;
    if (!this.configured) {
      this.logger.warn(`E-mail не налаштовано (SMTP_URL / MAIL_FROM) — лист «${subject}» не надіслано`);
      return false;
    }
    this.transport ??= nodemailer.createTransport(this.env.smtpUrl, { disableFileAccess: true, disableUrlAccess: true });
    await this.transport.sendMail({
      from: this.env.mailFrom,
      to: this.env.mailFrom,
      bcc: recipients,
      subject,
      text: `${text}\n\n—\nВійськовий облік · ${this.env.appUrl}\nЛист надіслано автоматично. Відписатися: Профіль → «Отримувати сповіщення на пошту».`,
    });
    return true;
  }
}
