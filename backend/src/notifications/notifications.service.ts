import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import { loadEnv } from '../config/env.js';
import { vocativeGivenName } from '../documents/name-declension.js';
import type { PasswordLinkMail, TemporaryPasswordMail } from '../shared/interfaces/mail.interface.js';
import { passwordChangeLetter, passwordExpiringLetter } from './templates/password-letters.template.js';
import type { UserRole } from '../shared/interfaces/auth.interface.js';
import { ROLE_ACCESS_TEXT } from '../users/users.constants.js';
import { accessLetter } from './templates/access-letter.template.js';
import { User } from '../users/user.entity.js';
import { MailService } from './mail.service.js';
import { NotificationLog } from './notification-log.entity.js';
import type { NotificationRef } from '../shared/interfaces/inbox.interface.js';

/** Who gets reminders: active users who have not turned them off, plus extra addresses of the legal entities. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(NotificationLog) private readonly log: Repository<NotificationLog>,
    private readonly mail: MailService,
    private readonly legalEntities: LegalEntitiesService,
  ) {}

  get mailConfigured() {
    return this.mail.configured;
  }

  /**
   * Users with reminders on + the extra addresses of the legal entity the reminder is about:
   * the accounts of that legal entity and the main administrators (they see all of them).
   * null — news for everyone (e.g. the mobilization term): every account and every legal entity's addresses.
   */
  async recipients(legalEntityId: string | null = null): Promise<string[]> {
    const on = { isActive: true, notify: true };
    const [users, extra] = await Promise.all([
      this.users.find({
        where: legalEntityId
          ? [
              { ...on, legalEntityId },
              { ...on, role: 'ADMIN' as const },
            ]
          : on,
      }),
      this.legalEntities.notifyEmails(legalEntityId),
    ]);
    return [...new Set([...users.map((u) => u.email), ...extra])];
  }

  /** A notice to the users (and the entity's extra addresses). Never throws — e-mail must not break the operation. */
  async notifyUsers(subject: string, text: string, legalEntityId: string | null = null): Promise<number> {
    try {
      const to = await this.recipients(legalEntityId);
      return (await this.mail.send(to, subject, text)) ? to.length : 0;
    } catch (err) {
      this.logger.error(`Не вдалося надіслати «${subject}»`, err as Error);
      return 0;
    }
  }

  /** A personal notice to one user (account created, password reset, deactivation). */
  async notifyUser(email: string, subject: string, text: string) {
    try {
      await this.mail.send([email], subject, text);
    } catch (err) {
      this.logger.error(`Не вдалося надіслати «${subject}» користувачу`, err as Error);
    }
  }

  /** The letter with a temporary password from the access mailbox. Never throws: false — not sent. */
  /** A plain letter to the given addresses (e.g. the vendor about an Enterprise request). Never throws. */
  async sendTo(emails: string[], subject: string, text: string): Promise<boolean> {
    try {
      return await this.mail.send(emails, subject, text);
    } catch (err) {
      this.logger.error(`Не вдалося надіслати лист «${subject}»`, err as Error);
      return false;
    }
  }

  async sendTemporaryPassword(mail: TemporaryPasswordMail): Promise<boolean> {
    try {
      const role = ROLE_ACCESS_TEXT[mail.role as UserRole] ?? ROLE_ACCESS_TEXT.HR;
      const letter = accessLetter({
        fullName: mail.fullName,
        greetingName: await vocativeGivenName(mail.fullName),
        login: mail.email,
        temporaryPassword: mail.temporaryPassword,
        expiresAt: mail.expiresAt,
        roleLabel: role.label,
        roleHint: role.hint,
        kind: mail.kind,
        asWhom: mail.asWhom ?? '',
        entityName: mail.entityName ?? '',
        entityCode: mail.entityCode ?? '',
        adminName: mail.issuedBy.fullName,
        adminEmail: mail.issuedBy.email,
        appUrl: this.env.appUrl,
      });
      return await this.mail.sendAccess(mail.email, letter);
    } catch (err) {
      this.logger.error('Не вдалося надіслати лист з тимчасовим паролем', err as Error);
      return false;
    }
  }

  /** Letter 1: «your password expires on …» with a link to set a new one. Never throws. */
  async sendPasswordExpiring(mail: PasswordLinkMail & { passwordExpiresAt: Date }): Promise<boolean> {
    try {
      const entity = await this.legalEntities.entityOfUser(mail.userId);
      const letter = passwordExpiringLetter({
        fullName: mail.fullName,
        greetingName: await vocativeGivenName(mail.fullName),
        login: mail.email,
        expiresAt: mail.passwordExpiresAt,
        link: mail.link,
        linkExpiresAt: mail.linkExpiresAt,
        appUrl: this.env.appUrl,
        entityName: entity?.name ?? '',
        entityCode: entity?.code ?? '',
      });
      return await this.mail.sendAccess(mail.email, letter);
    } catch (err) {
      this.logger.error('Не вдалося надіслати нагадування про зміну пароля', err as Error);
      return false;
    }
  }

  /** Letter 2: the administrator asks to change the password — a link to set a new one. Never throws. */
  async sendPasswordChangeRequest(mail: PasswordLinkMail & { issuedBy: { fullName: string; email: string } }) {
    try {
      const entity = await this.legalEntities.entityOfUser(mail.userId);
      const letter = passwordChangeLetter({
        fullName: mail.fullName,
        greetingName: await vocativeGivenName(mail.fullName),
        login: mail.email,
        link: mail.link,
        linkExpiresAt: mail.linkExpiresAt,
        adminName: mail.issuedBy.fullName,
        adminEmail: mail.issuedBy.email,
        appUrl: this.env.appUrl,
        entityName: entity?.name ?? '',
        entityCode: entity?.code ?? '',
      });
      return await this.mail.sendAccess(mail.email, letter);
    } catch (err) {
      this.logger.error('Не вдалося надіслати лист на зміну пароля', err as Error);
      return false;
    }
  }

  get accessMailConfigured() {
    return this.mail.accessConfigured;
  }

  async wasSent(kind: string, refId: string, refDate: string) {
    return this.log.existsBy({ kind, refId, refDate });
  }

  async markSent(kind: string, refs: NotificationRef[], recipients: number) {
    if (!refs.length) return;
    await this.log
      .createQueryBuilder()
      .insert()
      .values(refs.map((r) => ({ kind, ...r, recipients })))
      .orIgnore()
      .execute();
  }

  /** Test letter to one address (Settings → «Перевірити пошту»). */
  async test(email: string) {
    return this.mail.send(
      [email],
      'Перевірка пошти — військовий облік',
      'Якщо ви читаєте цей лист — сповіщення на пошту працюють.',
    );
  }
}
