import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service.js';

afterEach(() => vi.restoreAllMocks());

/** The service with a test SMTP configuration and a captured transport — nothing leaves the machine. */
function service(env: Record<string, string> = {}) {
  const mail = new MailService();
  const base = (mail as unknown as { env: object }).env;
  (mail as unknown as { env: object }).env = {
    ...base,
    smtpUrl: 'smtp://user:pass@smtp.example.com:587',
    mailFrom: 'Військовий облік <noreply@example.com>',
    accessSmtpUrl: 'smtp://user:pass@smtp.example.com:587',
    accessMailFrom: 'Доступи <access@example.com>',
    appUrl: 'https://app.example.com',
    ...env,
  };
  const sendMail = vi.fn(async () => ({}));
  vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
  return { mail, sendMail };
}

describe('MailService', () => {
  it('send: адресати в Bcc без повторів, у нижньому регістрі; підпис з адресою застосунку', async () => {
    const { mail, sendMail } = service();
    expect(await mail.send(['A@example.com', 'a@example.com ', 'b@example.com'], 'Тема', 'Текст')).toBe(true);
    const [msg] = sendMail.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(msg.bcc).toEqual(['a@example.com', 'b@example.com']);
    expect(msg.to).toBe('Військовий облік <noreply@example.com>');
    expect(String(msg.text)).toContain('https://app.example.com');
  });

  it('без адресатів чи без налаштувань — не надсилає', async () => {
    const { mail, sendMail } = service({ smtpUrl: '' });
    expect(mail.configured).toBe(false);
    expect(await mail.send(['a@example.com'], 's', 't')).toBe(false);
    expect(await mail.send([' '], 's', 't')).toBe(false);
    expect(await mail.sendLetter(['a@example.com'], { subject: 's', text: 't', html: '<p>t</p>' })).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sendLetter — HTML і текст; sendAccess — особисто, зі скриньки доступів', async () => {
    const { mail, sendMail } = service();
    await mail.sendLetter(['a@example.com'], { subject: 'Квота', text: 'Текст', html: '<p>HTML</p>' });
    expect((sendMail.mock.calls[0] as unknown as [Record<string, unknown>])[0].html).toBe('<p>HTML</p>');
    expect(await mail.sendAccess(' New@Example.com ', { subject: 'Доступ', text: 't', html: 'h' })).toBe(true);
    expect((sendMail.mock.calls[1] as unknown as [Record<string, unknown>])[0]).toMatchObject({
      to: 'new@example.com',
      from: 'Доступи <access@example.com>',
    });
  });

  it('скриньку доступів не налаштовано — лист з паролем не надсилається', async () => {
    const { mail } = service({ accessSmtpUrl: '' });
    expect(mail.accessConfigured).toBe(false);
    expect(await mail.sendAccess('a@example.com', { subject: 's', text: 't', html: 'h' })).toBe(false);
  });
});
