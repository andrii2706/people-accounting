import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { MFA_MAX_FAILED_CODES, MFA_TICKET_MINUTES, MFA_TICKET_TYPE } from '../common/constants/auth.constants.js';
import { fieldErrors } from '../common/validators/validators.js';
import { loadEnv } from '../config/env.js';
import type { LoginChallenge, TwoFactorSetup } from '../platform/contracts/session.js';
import { SecurityService } from '../security/security.service.js';
import type { MfaCodeResult, MfaStatus, MfaTicket } from '../shared/interfaces/auth.interface.js';
import type { SecurityActor } from '../shared/interfaces/security.interface.js';
import { User } from '../users/user.entity.js';
import {
  isRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  recoveryHash,
  verifyTotp,
} from './utils/totp.utils.js';

/**
 * The second step of the sign-in: a code from an authenticator app on the phone (TOTP). A stolen or guessed
 * password alone no longer opens the account. Ten recovery codes cover a lost phone; the administrator can turn
 * the code off for a person, who then sets the app up again at the next sign-in.
 */
@Injectable()
export class MfaService {
  private readonly env = loadEnv();
  /** The tickets are signed with their own key: a ticket can never pass for a session. */
  private readonly ticketSecret = createHash('sha256').update(`mfa-ticket:${this.env.jwtSecret}`).digest('hex');
  private readonly pepper = createHash('sha256').update(`mfa-recovery:${this.env.jwtSecret}`).digest('hex');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly security: SecurityService,
  ) {}

  /** The code is compulsory for the role (MFA_REQUIRED_ROLES). */
  required(role: string) {
    return (this.env.mfaRequiredRoles as string[]).includes(role);
  }

  /** After the right password: which step is still needed (null — none, the session is issued). */
  nextStep(user: Pick<User, 'role' | 'mfaEnabledAt'>): LoginChallenge['twoFactor'] | null {
    if (user.mfaEnabledAt) return 'CODE';
    return this.required(user.role) ? 'SETUP' : null;
  }

  async challenge(user: Pick<User, 'id' | 'tokenVersion'>, step: LoginChallenge['twoFactor']): Promise<LoginChallenge> {
    const ticket = await this.jwt.signAsync(
      { sub: user.id, ver: user.tokenVersion, typ: MFA_TICKET_TYPE, step },
      { secret: this.ticketSecret, algorithm: 'HS256', expiresIn: `${MFA_TICKET_MINUTES}m` },
    );
    return { twoFactor: step, ticket, expiresAt: new Date(Date.now() + MFA_TICKET_MINUTES * 60_000).toISOString() };
  }

  /** The account the ticket is for — if it is still valid, for this step, and the password has not changed since. */
  async fromTicket(ticket: string, step: LoginChallenge['twoFactor']): Promise<User> {
    const expired = () =>
      new UnauthorizedException('Час на введення коду минув або вхід почато в іншій вкладці. Увійдіть ще раз.');
    let payload: MfaTicket;
    try {
      payload = await this.jwt.verifyAsync<MfaTicket>(ticket, { secret: this.ticketSecret, algorithms: ['HS256'] });
    } catch {
      throw expired();
    }
    if (payload.typ !== MFA_TICKET_TYPE || payload.step !== step) throw expired();
    const user = await this.withSecrets(payload.sub);
    if (!user?.isActive || user.tokenVersion !== payload.ver) throw expired();
    if (user.lockedUntil && user.lockedUntil > new Date()) throw this.lockedError(user.lockedUntil);
    return user;
  }

  /**
   * The code from the app, or a recovery code. Wrong codes are counted apart from wrong passwords and are not
   * reset by the right password: whoever knows the password cannot try codes forever.
   */
  async checkCode(user: User, code: string, actor: SecurityActor): Promise<MfaCodeResult> {
    if (!user.mfaSecret || !user.mfaEnabledAt) return { status: 'invalid', left: 0 };
    const step = verifyTotp(user.mfaSecret, code, user.mfaLastStep);
    if (step !== null) {
      await this.users.update(user.id, { mfaLastStep: step, mfaFailedCount: 0 });
      return { status: 'ok' };
    }
    if (isRecoveryCode(code)) {
      const hash = recoveryHash(code, this.pepper);
      const match = user.mfaRecoveryHashes.find((h) => timingSafeEqual(Buffer.from(h), Buffer.from(hash)));
      if (match) {
        const left = user.mfaRecoveryHashes.filter((h) => h !== match);
        await this.users.update(user.id, { mfaRecoveryHashes: left, mfaFailedCount: 0 });
        await this.security.record('MFA_RECOVERY_USED', this.actor(user, actor), { left: left.length });
        return { status: 'recovery', left: left.length };
      }
    }
    const failed = user.mfaFailedCount + 1;
    if (failed >= MFA_MAX_FAILED_CODES) {
      const lockedUntil = new Date(Date.now() + this.env.lockoutMinutes * 60_000);
      await this.users.update(user.id, { mfaFailedCount: 0, lockedUntil });
      await this.security.record('MFA_LOCKED', this.actor(user, actor), { failures: failed });
      return { status: 'locked', lockedUntil };
    }
    await this.users.update(user.id, { mfaFailedCount: failed });
    return { status: 'invalid', left: MFA_MAX_FAILED_CODES - failed };
  }

  lockedError(until: Date) {
    const time = until.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' });
    return new UnauthorizedException(`Забагато неправильних спроб. Вхід заблоковано до ${time}`);
  }

  /** A new secret (not on yet): the QR code for the app and the same key as text. */
  async begin(user: User): Promise<TwoFactorSetup> {
    if (user.mfaEnabledAt) throw new ConflictException('Вхід з кодом уже увімкнено');
    const secret = newTotpSecret();
    await this.users.update(user.id, { mfaSecret: secret });
    const url = otpauthUrl(this.env.mfaIssuer, user.email, secret);
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules;
    return {
      secret: secret.replace(/(.{4})/g, '$1 ').trim(),
      otpauthUrl: url,
      qr: { size: qr.size, cells: Array.from(qr.data, (c) => (c ? '1' : '0')).join('') },
    };
  }

  /** The first right code from the app turns it on; the recovery codes are returned once. */
  async enable(user: User, code: string, actor: SecurityActor): Promise<string[]> {
    if (user.mfaEnabledAt) throw new ConflictException('Вхід з кодом уже увімкнено');
    const step = user.mfaSecret ? verifyTotp(user.mfaSecret, code, null) : null;
    if (step === null) {
      throw fieldErrors([
        {
          field: 'code',
          message: 'Код не підходить. Перевірте, що відсканували саме цей QR-код і що час на телефоні правильний.',
        },
      ]);
    }
    const codes = newRecoveryCodes();
    await this.users.update(user.id, {
      mfaEnabledAt: new Date(),
      mfaLastStep: step,
      mfaFailedCount: 0,
      mfaRecoveryHashes: codes.map((c) => recoveryHash(c, this.pepper)),
    });
    await this.security.record('MFA_ENABLED', this.actor(user, actor));
    return codes;
  }

  /** Own: turn the code off (only where the role does not require it) — the password and a code are asked. */
  async disable(userId: string, password: string, code: string, actor: SecurityActor) {
    const user = await this.reauth(userId, password, code, actor);
    if (this.required(user.role)) throw new ForbiddenException('Для вашої ролі вхід з кодом обов’язковий');
    await this.clear(user.id);
    await this.security.record('MFA_DISABLED', this.actor(user, actor));
    return this.status(user.id);
  }

  /** Own: new recovery codes (the old ones stop working). */
  async renewCodes(userId: string, password: string, code: string, actor: SecurityActor) {
    const user = await this.reauth(userId, password, code, actor);
    const codes = newRecoveryCodes();
    await this.users.update(user.id, { mfaRecoveryHashes: codes.map((c) => recoveryHash(c, this.pepper)) });
    await this.security.record('MFA_CODES_RENEWED', this.actor(user, actor));
    return codes;
  }

  /** Own: before a new secret is made — the password once more (an open session alone is not enough). */
  async beginOwn(userId: string, password: string) {
    const user = await this.withSecrets(userId);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw fieldErrors([{ field: 'password', message: 'Пароль невірний' }]);
    }
    return this.begin(user);
  }

  async enableOwn(userId: string, code: string, actor: SecurityActor) {
    const user = await this.withSecrets(userId);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.enable(user, code, actor);
  }

  /** The administrator: the person sets the app up again (a lost phone without the recovery codes). */
  async reset(targetId: string, by: { id: string; fullName: string }, actor: SecurityActor) {
    const user = await this.withSecrets(targetId);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    await this.clear(user.id, user.tokenVersion + 1);
    await this.security.record('MFA_RESET', { ...this.actor(user, actor), ip: actor.ip }, { by: by.fullName });
  }

  async status(userId: string): Promise<MfaStatus> {
    const user = await this.withSecrets(userId);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return {
      enabled: !!user.mfaEnabledAt,
      enabledAt: user.mfaEnabledAt?.toISOString() ?? null,
      required: this.required(user.role),
      recoveryLeft: user.mfaEnabledAt ? user.mfaRecoveryHashes.length : 0,
    };
  }

  /** The password and a current code (or a recovery code) — for changes to the second step itself. */
  private async reauth(userId: string, password: string, code: string, actor: SecurityActor) {
    const user = await this.withSecrets(userId);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (!user.mfaEnabledAt) throw new BadRequestException('Вхід з кодом не увімкнено');
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw fieldErrors([{ field: 'password', message: 'Пароль невірний' }]);
    }
    const result = await this.checkCode(user, code, actor);
    if (result.status === 'locked') throw this.lockedError(result.lockedUntil);
    if (result.status === 'invalid') throw fieldErrors([{ field: 'code', message: 'Невірний код' }]);
    return user;
  }

  private clear(id: string, tokenVersion?: number) {
    return this.users.update(id, {
      mfaSecret: null,
      mfaEnabledAt: null,
      mfaLastStep: null,
      mfaFailedCount: 0,
      mfaRecoveryHashes: [],
      ...(tokenVersion !== undefined ? { tokenVersion } : {}),
    });
  }

  private actor(user: User, from: SecurityActor): SecurityActor {
    return { ...from, userId: user.id, userName: user.fullName, email: user.email, legalEntityId: user.legalEntityId };
  }

  private withSecrets(id: string) {
    return this.users
      .createQueryBuilder('u')
      .addSelect([
        'u.passwordHash',
        'u.tokenVersion',
        'u.mfaSecret',
        'u.mfaRecoveryHashes',
        'u.mfaLastStep',
        'u.mfaFailedCount',
      ])
      .where('u.id = :id', { id })
      .getOne();
  }
}
