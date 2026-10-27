import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { generateTemporaryPassword, passwordMessage, passwordProblems } from '../common/password-policy.js';
import { loadEnv } from '../config/env.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { User } from './user.entity.js';

const BCRYPT_ROUNDS = 12;
/** Hash used to equalize response time when the email does not exist (protection against email enumeration). */
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-password', BCRYPT_ROUNDS);

export type CredentialsResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid'; userId?: string }
  | { status: 'locked'; userId: string; lockedUntil: Date };

@Injectable()
export class UsersService {
  private readonly env = loadEnv();

  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  list() {
    return this.repo.find({ order: { fullName: 'ASC' } });
  }

  async findById(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }

  findForSession(id: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.tokenVersion').where('u.id = :id', { id }).getOne();
  }

  private findWithSecrets(where: { id?: string; email?: string }) {
    const qb = this.repo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.tokenVersion', 'u.failedLoginCount']);
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
    await this.repo.update(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
    return { status: 'ok', user };
  }

  async create(dto: CreateUserDto, opts: { mustChangePassword?: boolean } = {}) {
    const email = dto.email.toLowerCase();
    if (await this.repo.exists({ where: { email } })) throw new ConflictException('Користувач з таким email вже існує');
    this.assertPolicy(dto.password, email);
    const saved = await this.repo.save(
      this.repo.create({
        email,
        fullName: dto.fullName,
        role: dto.role ?? 'HR',
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        // a password set by an administrator is temporary
        mustChangePassword: opts.mustChangePassword ?? true,
        passwordChangedAt: new Date(),
      }),
    );
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.findWithSecrets({ id });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    if (id === actorId && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new BadRequestException('Не можна заблокувати себе або зняти з себе роль адміністратора');
    }
    const changes: Partial<User> = {};
    if (dto.fullName !== undefined) changes.fullName = dto.fullName;
    if (dto.role !== undefined && dto.role !== user.role) {
      changes.role = dto.role;
      changes.tokenVersion = user.tokenVersion + 1;
    }
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      changes.isActive = dto.isActive;
      changes.tokenVersion = user.tokenVersion + 1; // lockout — instant sign-out from all sessions
    }
    if (Object.keys(changes).length) await this.repo.update(id, changes);
    return this.findById(id);
  }

  /** Administrator resets a password: a temporary one is generated, shown once, the user's sessions are terminated. */
  async resetPassword(id: string) {
    const user = await this.findWithSecrets({ id });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    const temporaryPassword = generateTemporaryPassword(randomBytes);
    await this.repo.update(id, {
      passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
      mustChangePassword: true,
      tokenVersion: user.tokenVersion + 1,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    });
    return { temporaryPassword };
  }

  async unlock(id: string) {
    await this.findById(id);
    await this.repo.update(id, { failedLoginCount: 0, lockedUntil: null });
    return this.findById(id);
  }

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.findWithSecrets({ id });
    if (!user) throw new NotFoundException();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new BadRequestException('Поточний пароль невірний');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('Новий пароль має відрізнятися від поточного');
    this.assertPolicy(newPassword, user.email);
    await this.repo.update(id, {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
      passwordChangedAt: new Date(),
    });
    return (await this.findForSession(id))!;
  }

  /** First administrator from environment variables. In production the password is temporary. */
  async ensureAdmin(email: string, password: string, fullName: string) {
    const existing = await this.repo.findOneBy({ email: email.toLowerCase() });
    if (existing) return existing;
    return this.create({ email, password, fullName, role: 'ADMIN' }, { mustChangePassword: this.env.isProduction });
  }

  private assertPolicy(password: string, email: string) {
    const problems = passwordProblems(password, email);
    if (problems.length) throw new BadRequestException(passwordMessage(problems));
  }
}
