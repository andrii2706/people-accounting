import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { IsNull, Not, Repository } from 'typeorm';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { sha256 } from '../common/utils/hash.utils.js';
import {
  generateTemporaryPassword,
  passwordExpiresAt,
  passwordProblems,
} from '../common/utils/password-policy.utils.js';
import { fieldErrors } from '../common/validators/validators.js';
import { loadEnv } from '../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { User } from './user.entity.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { roleEntityProblem } from './utils/user-policy.utils.js';
import type {
  EntityAccountContext,
  AuthUser,
  CreateUserOptions,
  CredentialsResult,
  IssuedTemporaryPassword,
  PasswordAgeFields,
  PasswordChangeRequestResult,
  PasswordLinkInfo,
  PasswordLinkPurpose,
  Scope,
  UserLookup,
  UserRole,
} from '../shared/interfaces/auth.interface.js';
import { BCRYPT_ROUNDS } from './users.constants.js';
import { DUMMY_HASH, ROLE_LABELS } from './users.constants.js';

@Injectable()
export class UsersService {
  private readonly env = loadEnv();

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(PasswordResetToken) private readonly links: Repository<PasswordResetToken>,
    private readonly notifications: NotificationsService,
  ) {}

  /** When the password of this account stops working (HR / DIRECTOR — half a year); null — never. */
  passwordExpiresAt(user: PasswordAgeFields): Date | null {
    return passwordExpiresAt(user, this.env.passwordMaxAgeDays, this.env.passwordExpiryRoles);
  }

  /** The password is older than allowed — the user is let in only to change it. */
  async enforcePasswordAge(user: User): Promise<void> {
    const expires = this.passwordExpiresAt(user);
    if (!expires || expires > new Date() || user.mustChangePassword) return;
    await this.repo.update(user.id, { mustChangePassword: true });
    user.mustChangePassword = true;
  }

  /**
   * A one-time link to set a new password (letters «the password expires» and «change the password»).
   * Earlier unused links of the user stop working. Returns the raw token — it goes only into the letter.
   */
  async createPasswordLink(userId: string, purpose: PasswordLinkPurpose, hours: number) {
    await this.links.update({ userId, usedAt: IsNull() }, { usedAt: new Date() });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    await this.links.save(this.links.create({ userId, tokenHash: sha256(Buffer.from(token)), purpose, expiresAt }));
    return { link: `${this.env.appUrl.replace(/\/+$/, '')}/reset-password?token=${token}`, expiresAt };
  }

  private async validLink(token: string) {
    const link = token
      ? await this.links.findOne({ where: { tokenHash: sha256(Buffer.from(token)) }, relations: { user: true } })
      : null;
    if (!link || link.usedAt || link.expiresAt < new Date() || !link.user?.isActive || link.user.role === 'VENDOR') {
      throw new BadRequestException('Посилання недійсне або вже використане — попросіть адміністратора надіслати нове');
    }
    return link;
  }

  /** Who the link is for (the reset page shows the login). */
  async passwordLinkInfo(token: string): Promise<PasswordLinkInfo> {
    const link = await this.validLink(token);
    return { email: link.user.email, fullName: link.user.fullName, purpose: link.purpose, expiresAt: link.expiresAt };
  }

  /** Sets a new password by the link from a letter; all sessions of the user end. */
  async resetWithLink(token: string, newPassword: string) {
    const link = await this.validLink(token);
    const user = await this.findWithSecrets({ id: link.userId });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    this.assertPolicy(newPassword, user.email, 'newPassword');
    if (await bcrypt.compare(newPassword, user.passwordHash))
      throw fieldErrors([{ field: 'newPassword', message: 'Має відрізнятися від поточного' }]);
    await this.repo.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
      passwordChangedAt: new Date(),
      temporaryPasswordExpiresAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    await this.links.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    await this.notifications.notifyUser(
      user.email,
      'Пароль змінено',
      'Пароль до вашого облікового запису в системі військового обліку щойно змінено за посиланням з листа. ' +
        'Якщо це були не ви — негайно зверніться до адміністратора.',
    );
    return { id: user.id, email: user.email };
  }

  /**
   * The administrator asks a user to change the password: from now on the user is let in only to the password
   * change; the letter has a link to set a new one.
   */
  async requestPasswordChange(id: string, issuedBy: AuthUser): Promise<PasswordChangeRequestResult> {
    const user = await this.findById(id);
    if (!user.isActive) throw new BadRequestException('Обліковий запис вимкнено — спершу увімкніть його');
    await this.repo.update(id, { mustChangePassword: true });
    const { link, expiresAt } = await this.createPasswordLink(id, 'ADMIN_REQUEST', this.env.passwordLinkHours);
    const mailSent = await this.notifications.sendPasswordChangeRequest({
      userId: id,
      email: user.email,
      fullName: user.fullName,
      link,
      linkExpiresAt: expiresAt,
      issuedBy,
    });
    return { mailSent, email: user.email };
  }

  private roleLabel(role: UserRole) {
    return ROLE_LABELS[role];
  }

  /**
   * Users of the client: of one legal entity (scope), or all of them (the main administrator).
   * The vendor account is not shown and cannot be changed by the client's admin.
   */
  list(scope: Scope = null) {
    return this.repo.find({
      where: { role: Not('VENDOR'), ...(scope ? { legalEntityId: scope } : {}) },
      order: { fullName: 'ASC' },
    });
  }

  /** The legal entity of an account must fit its role and exist. */
  private async checkEntity(role: UserRole, legalEntityId: string | null) {
    const problem = roleEntityProblem(role, legalEntityId);
    if (problem) throw fieldErrors([{ field: 'legalEntityId', message: problem }]);
    if (legalEntityId && !(await this.repo.manager.existsBy(LegalEntity, { id: legalEntityId }))) {
      throw fieldErrors([{ field: 'legalEntityId', message: 'Юридичну особу не знайдено' }]);
    }
  }

  /** «ТОВ «Приклад»» and its code for the letter with a temporary password. */
  private async entityContext(legalEntityId: string | null) {
    if (!legalEntityId) return {};
    const e = await this.repo.manager.findOneBy(LegalEntity, { id: legalEntityId });
    return e ? { entityName: e.shortName || e.fullName, entityCode: e.edrpou } : {};
  }

  /** Puts the account into a legal entity (the director who has just added his). */
  async assignEntity(id: string, legalEntityId: string) {
    await this.repo.update(id, { legalEntityId });
  }

  async findById(id: string) {
    const user = await this.repo.findOneBy({ id, role: Not('VENDOR') });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }

  findForSession(id: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.tokenVersion').where('u.id = :id', { id }).getOne();
  }

  private findWithSecrets(where: UserLookup) {
    const qb = this.repo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.tokenVersion', 'u.failedLoginCount', 'u.temporaryPasswordExpiresAt']);
    if (where.id) qb.where('u.id = :id', { id: where.id });
    else qb.where('LOWER(u.email) = LOWER(:email)', { email: where.email });
    return qb.getOne();
  }

  /** Credential check with a failed-attempt counter and temporary lockout. */
  async verifyCredentials(email: string, password: string): Promise<CredentialsResult> {
    const user = await this.findWithSecrets({ email });
    if (!user || !user.isActive) {
      await bcrypt.compare(password, DUMMY_HASH);
      return { status: 'invalid', userId: user?.id };
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { status: 'locked', userId: user.id, lockedUntil: user.lockedUntil };
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const failed = user.failedLoginCount + 1;
      if (failed >= this.env.maxFailedLogins) {
        const lockedUntil = new Date(Date.now() + this.env.lockoutMinutes * 60_000);
        await this.repo.update(user.id, { failedLoginCount: 0, lockedUntil });
        return { status: 'locked', userId: user.id, lockedUntil };
      }
      await this.repo.update(user.id, { failedLoginCount: failed });
      return { status: 'invalid', userId: user.id };
    }
    // a temporary password issued by the administrator works only for a limited time
    if (user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt < new Date()) {
      return { status: 'expired', userId: user.id };
    }
    await this.repo.update(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
    // the half-year password of HR / directors: after it expires the user is let in only to change it
    await this.enforcePasswordAge(user);
    return { status: 'ok', user };
  }

  async create(dto: CreateUserDto, opts: CreateUserOptions = {}) {
    const email = dto.email.toLowerCase();
    if (await this.repo.exists({ where: { email } }))
      throw fieldErrors([{ field: 'email', message: 'Користувач з таким email уже існує' }]);
    this.assertPolicy(dto.password, email);
    const role = dto.role ?? 'HR';
    const legalEntityId = role === 'ADMIN' ? null : (dto.legalEntityId ?? null);
    await this.checkEntity(role, legalEntityId);
    const saved = await this.repo.save(
      this.repo.create({
        email,
        fullName: dto.fullName,
        role,
        legalEntityId,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        // a password set by an administrator is temporary
        mustChangePassword: opts.mustChangePassword ?? true,
        passwordChangedAt: new Date(),
        temporaryPasswordExpiresAt: (opts.mustChangePassword ?? true) && !opts.silent ? this.temporaryUntil() : null,
      }),
    );
    if (!opts.silent && opts.issuedBy) {
      // created by the administrator: the temporary password goes to the person from the access mailbox
      await this.notifications.sendTemporaryPassword({
        email,
        fullName: saved.fullName,
        role: saved.role,
        temporaryPassword: dto.password,
        expiresAt: saved.temporaryPasswordExpiresAt ?? this.temporaryUntil(),
        kind: 'NEW',
        issuedBy: opts.issuedBy,
        ...(await this.entityContext(legalEntityId)),
      });
    } else if (!opts.silent) {
      // without an administrator (CLI, scripts) the password is not e-mailed — only a notice about the account
      await this.notifications.notifyUser(
        email,
        'Вам надано доступ до системи військового обліку',
        `Для вас створено обліковий запис (роль: ${this.roleLabel(saved.role)}).\n` +
          `Адреса: ${this.env.appUrl}\nЛогін: ${email}\n` +
          'Тимчасовий пароль вам передасть адміністратор особисто. Під час першого входу система попросить його змінити.',
      );
    }
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.findWithSecrets({ id });
    if (!user || user.role === 'VENDOR') throw new NotFoundException('Користувача не знайдено');
    if (id === actorId && (dto.isActive === false || (dto.role && dto.role !== user.role))) {
      throw new BadRequestException('Не можна заблокувати себе або змінити власну роль');
    }
    const changes: Partial<User> = {};
    if (dto.fullName !== undefined) changes.fullName = dto.fullName;
    // the role and the legal entity are checked together: e.g. HR needs one, the main administrator has none
    const role = dto.role ?? user.role;
    const legalEntityId =
      role === 'ADMIN' ? null : dto.legalEntityId !== undefined ? dto.legalEntityId : user.legalEntityId;
    if (role !== user.role || legalEntityId !== user.legalEntityId) {
      await this.checkEntity(role, legalEntityId);
      if (legalEntityId !== user.legalEntityId) changes.legalEntityId = legalEntityId;
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      changes.role = dto.role;
      changes.tokenVersion = user.tokenVersion + 1;
    }
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      changes.isActive = dto.isActive;
      changes.tokenVersion = user.tokenVersion + 1; // lockout — instant sign-out from all sessions
    }
    if (dto.notify !== undefined) changes.notify = dto.notify;
    if (Object.keys(changes).length) await this.repo.update(id, changes);
    if (changes.role) {
      await this.notifications.notifyUser(
        user.email,
        'Змінено вашу роль у системі військового обліку',
        `Ваша нова роль: ${this.roleLabel(changes.role)}. Увійдіть знову, щоб зміни набули чинності.`,
      );
    }
    if (changes.isActive === false) {
      await this.notifications.notifyUser(
        user.email,
        'Доступ до системи військового обліку припинено',
        'Адміністратор вимкнув ваш обліковий запис. Якщо це помилка — зверніться до адміністратора.',
      );
    } else if (changes.isActive === true) {
      await this.notifications.notifyUser(
        user.email,
        'Доступ до системи військового обліку відновлено',
        `Ваш обліковий запис знову активний: ${this.env.appUrl}`,
      );
    }
    return this.findById(id);
  }

  /** Any account by its login e-mail (the vendor included — the caller decides). */
  findByEmail(email: string) {
    return this.repo.findOneBy({ email: email.trim().toLowerCase() });
  }

  /**
   * An account for a person the administrator gives access to (the head, the responsible person):
   * a temporary password is generated and shown to the administrator once, the user changes it on first sign-in.
   */
  async createWithTemporaryPassword(
    email: string,
    fullName: string,
    role: UserRole,
    issuedBy: AuthUser,
    context: EntityAccountContext,
  ) {
    const temporaryPassword = generateTemporaryPassword(randomBytes);
    const expiresAt = this.temporaryUntil();
    const { legalEntityId, ...letter } = context;
    const user = await this.create(
      { email, fullName, role, password: temporaryPassword, legalEntityId },
      { silent: true },
    );
    await this.repo.update(user.id, { temporaryPasswordExpiresAt: expiresAt });
    const mailSent = await this.notifications.sendTemporaryPassword({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      temporaryPassword,
      expiresAt,
      kind: 'NEW',
      issuedBy,
      ...letter,
    });
    return { user, temporaryPassword, mailSent, expiresAt };
  }

  /** Until when a temporary password issued now is valid. */
  private temporaryUntil() {
    return new Date(Date.now() + this.env.temporaryPasswordHours * 3_600_000);
  }

  /**
   * Administrator resets a password: a temporary one is generated, shown once and e-mailed from the access
   * mailbox; it expires after TEMPORARY_PASSWORD_HOURS; the user's sessions are terminated.
   */
  async resetPassword(id: string, issuedBy: AuthUser): Promise<IssuedTemporaryPassword> {
    const user = await this.findWithSecrets({ id });
    if (!user || user.role === 'VENDOR') throw new NotFoundException('Користувача не знайдено');
    const temporaryPassword = generateTemporaryPassword(randomBytes);
    const expiresAt = this.temporaryUntil();
    await this.repo.update(id, {
      passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
      mustChangePassword: true,
      tokenVersion: user.tokenVersion + 1,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
      temporaryPasswordExpiresAt: expiresAt,
    });
    const mailSent = await this.notifications.sendTemporaryPassword({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      temporaryPassword,
      expiresAt,
      kind: 'RESET',
      issuedBy,
      ...(await this.entityContext(user.legalEntityId)),
    });
    return { temporaryPassword, mailSent, expiresAt };
  }

  async preferences(id: string) {
    const user = await this.findById(id);
    return { notify: user.notify };
  }

  async updatePreferences(id: string, notify: boolean) {
    await this.repo.update(id, { notify });
    return this.preferences(id);
  }

  async unlock(id: string) {
    await this.findById(id);
    await this.repo.update(id, { failedLoginCount: 0, lockedUntil: null });
    return this.findById(id);
  }

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.findWithSecrets({ id });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw fieldErrors([{ field: 'currentPassword', message: 'Поточний пароль невірний' }]);
    if (await bcrypt.compare(newPassword, user.passwordHash))
      throw fieldErrors([{ field: 'newPassword', message: 'Має відрізнятися від поточного' }]);
    this.assertPolicy(newPassword, user.email, 'newPassword');
    await this.repo.update(id, {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
      passwordChangedAt: new Date(),
      temporaryPasswordExpiresAt: null,
    });
    await this.links.update({ userId: id, usedAt: IsNull() }, { usedAt: new Date() });
    await this.notifications.notifyUser(
      user.email,
      'Пароль змінено',
      'Пароль до вашого облікового запису в системі військового обліку щойно змінено. Якщо це були не ви — зверніться до адміністратора.',
    );
    return (await this.findForSession(id))!;
  }

  /**
   * Vendor account (CLI `npm run billing -- --create-vendor`): sees only the payment page.
   * Created by us, not by the client's admin; the password is set by the one who runs the command.
   */
  async createVendor(email: string, fullName: string, password: string) {
    const normalized = email.toLowerCase();
    if (await this.repo.exists({ where: { email: normalized } }))
      throw fieldErrors([{ field: 'email', message: 'Користувач з таким email уже існує' }]);
    this.assertPolicy(password, normalized);
    const saved = await this.repo.save(
      this.repo.create({
        email: normalized,
        fullName,
        role: 'VENDOR',
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      }),
    );
    return (await this.findForSession(saved.id))!;
  }

  /** First administrator from environment variables. In production the password is temporary. */
  async ensureAdmin(email: string, password: string, fullName: string) {
    const existing = await this.repo.findOneBy({ email: email.toLowerCase() });
    if (existing) return existing;
    return this.create(
      { email, password, fullName, role: 'ADMIN' },
      { mustChangePassword: this.env.isProduction, silent: true },
    );
  }

  private assertPolicy(password: string, email: string, field = 'password') {
    const problems = passwordProblems(password, email);
    if (problems.length) throw fieldErrors([{ field, message: `Потрібно: ${problems.join(', ')}` }]);
  }
}
