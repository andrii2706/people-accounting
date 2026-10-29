import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/organization.entity.js';
import { User } from '../users/user.entity.js';
import { MailService } from './mail.service.js';
import { NotificationLog } from './notification-log.entity.js';

export const NIL_REF = '00000000-0000-0000-0000-000000000000';

/** Who gets reminders: active users who have not turned them off, plus extra addresses from the settings. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly org: Repository<Organization>,
    @InjectRepository(NotificationLog) private readonly log: Repository<NotificationLog>,
    private readonly mail: MailService,
  ) {}

  get mailConfigured() {
    return this.mail.configured;
  }

  async recipients(): Promise<string[]> {
    const [users, org] = await Promise.all([this.users.find({ where: { isActive: true, notify: true } }), this.org.findOneBy({ id: 1 })]);
    const extra = (org?.notifyEmails ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    return [...users.map((u) => u.email), ...extra];
  }

  /** A notice to all users (e.g. a change of director). Never throws — e-mail must not break the operation. */
  async notifyUsers(subject: string, text: string): Promise<number> {
    try {
      const to = await this.recipients();
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

  /** Has this reminder already been sent? */
  async wasSent(kind: string, refId: string, refDate: string) {
    return this.log.existsBy({ kind, refId, refDate });
  }

  async markSent(kind: string, refs: { refId: string; refDate: string }[], recipients: number) {
    if (!refs.length) return;
    await this.log.createQueryBuilder().insert().values(refs.map((r) => ({ kind, ...r, recipients }))).orIgnore().execute();
  }

  /** Test letter to one address (Settings → «Перевірити пошту»). */
  async test(email: string) {
    return this.mail.send([email], 'Перевірка пошти — військовий облік', 'Якщо ви читаєте цей лист — сповіщення на пошту працюють.');
  }
}
