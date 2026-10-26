import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailMessage {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  messageId: string;
  /** true — SMTP не налаштовано, лист збережено у папку outbox. */
  dev: boolean;
  savedTo?: string;
}

/**
 * Надсилання пошти через SMTP (корпоративний сервер, Gmail Workspace, Ukr.net тощо).
 * Якщо SMTP_HOST не задано — лист зберігається як .eml у MAIL_OUTBOX_DIR для перевірки.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly devMode: boolean;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.devMode = !host;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT') ?? 587),
          secure: config.get('SMTP_SECURE') === 'true',
          auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') } : undefined,
        })
      : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    if (this.devMode) this.logger.warn('SMTP_HOST не задано — листи зберігатимуться в outbox, а не надсилатимуться');
  }

  get isConfigured() {
    return !this.devMode;
  }

  async send(message: MailMessage): Promise<MailResult> {
    const from = this.config.get<string>('SMTP_FROM') ?? 'military-registry@localhost';
    const info = await this.transporter.sendMail({ from, ...message });

    if (!this.devMode) return { messageId: String(info.messageId ?? ''), dev: false };

    const dir = this.config.get<string>('MAIL_OUTBOX_DIR') ?? join(process.cwd(), 'storage', 'outbox');
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`);
    await writeFile(file, (info as unknown as { message: Buffer }).message);
    return { messageId: `dev-${Date.now()}`, dev: true, savedTo: file };
  }
}
