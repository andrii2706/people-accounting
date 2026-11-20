/**
 * LOCAL ONLY: a new password for an account of this computer's database (the same accounts sign in to the portal).
 *
 *   npm run password:reset                       — the administrator from ADMIN_EMAIL
 *   npm run password:reset -- user@company.ua    — another account
 *   npm run password:reset -- user@company.ua --mfa   — also turn off the sign-in code (lost phone)
 *   npm run password:reset -- admin@gmail.com --password "ChangeMe123!"   — exactly this password; an account
 *       that does not exist yet is created as an administrator
 *   npm run password:reset admin@gmail.com ChangeMe123!                    — the same without flags
 *
 * Prints the new password, unlocks the account and ends its sessions. Never runs in production
 * (NODE_ENV=production): there the password is reset by an administrator or by «Забули пароль?».
 */
import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { loadEnv } from '../config/env.js';
import { User } from '../users/user.entity.js';
import { BCRYPT_ROUNDS } from '../users/users.constants.js';
import { passwordProblems } from '../common/utils/password-policy.utils.js';
import { buildDataSourceOptions } from './data-source.js';
import { databaseLabel } from './utils/database-label.utils.js';

/** Letters and digits that cannot be misread (no 0/O, 1/l/I), with a dash in the middle: easy to type. */
function newPassword(email: string): string {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    const part = (n: number) => Array.from({ length: n }, () => abc[randomInt(abc.length)]).join('');
    const password = `${part(5)}-${part(5)}-${randomInt(10, 99)}`;
    if (!passwordProblems(password, email).length) return password;
  }
}

async function resetPassword() {
  const env = loadEnv();
  if (env.isProduction) {
    console.error('Лише для локальної бази. У production пароль скидає адміністратор або «Забули пароль?».');
    process.exitCode = 1;
    return;
  }
  const args = process.argv.slice(2);
  // --password X or --password=X; the value itself is not taken for the email
  const at = args.findIndex((a) => a === '--password' || a.startsWith('--password='));
  const given = at < 0 ? undefined : args[at].includes('=') ? args[at].slice(11) : args[at + 1];
  if (at >= 0 && !given) {
    console.error('Після --password вкажіть пароль: --password "ChangeMe123!"');
    process.exitCode = 1;
    return;
  }
  const positional = args.filter(
    (a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1 && !args[at].includes('=')),
  );
  // the password may also come second, without a flag: «… admin@gmail.com ChangeMe123!» (PowerShell eats «--»)
  const chosen = given ?? positional[1];
  const email = (positional[0] ?? process.env.ADMIN_EMAIL ?? 'admin@example.com').trim().toLowerCase();
  const dropMfa = args.includes('--mfa');

  const db = new DataSource({ ...buildDataSourceOptions(), logging: false });
  try {
    await db.initialize();
  } catch {
    console.error(`База не відповідає (DATABASE_URL у backend/.env). Запустіть PostgreSQL і повторіть.`);
    process.exitCode = 1;
    return;
  }
  try {
    const repo = db.getRepository(User);
    // the same lookup as the sign-in: the email in any case (an «Admin@…» typed by hand is the same account)
    let user = await repo.createQueryBuilder('u').where('LOWER(TRIM(u.email)) = :email', { email }).getOne();
    if (!user && chosen) {
      user = await repo.save(
        repo.create({ email, fullName: 'Адміністратор', role: 'ADMIN', passwordHash: '!', modules: ['oblik'] }),
      );
      console.log(`  Обліковий запис ${email} створено (адміністратор).`);
    }
    if (!user) {
      const all = await repo.find({ select: { email: true, role: true }, order: { email: 'ASC' }, take: 20 });
      console.error(
        `Немає облікового запису ${email}. Є: ${all.map((u) => `${u.email} (${u.role})`).join(', ')}\n` +
          `Створити його: npm run password:reset -- ${email} --password "<пароль>"`,
      );
      process.exitCode = 1;
      return;
    }
    const password = chosen ?? newPassword(email);
    const weak = passwordProblems(password, email);
    if (weak.length) console.warn(`  Увага: пароль не відповідає правилам (${weak.join(', ')}) — локально прийнято.`);
    await repo.update(user.id, {
      email, // a hand-edited «Admin@gmail.com » becomes the one the sign-in finds
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      isActive: true,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
      mfaFailedCount: 0,
      passwordChangedAt: new Date(),
      temporaryPasswordExpiresAt: null,
      ...(dropMfa ? { mfaSecret: null, mfaEnabledAt: null, mfaRecoveryHashes: [], mfaLastStep: null } : {}),
      tokenVersion: () => '"tokenVersion" + 1', // the old sessions end
    });
    // shown in full (a local database only): what the shell passed may differ from what was typed (%, ^, &, $)
    console.log(`\n  база: ${databaseLabel()}\n  ${email}\n  пароль: ${password}\n`);
    console.log('  Вхід у застосунку відповідає «Невірний email або пароль»? Його API працює з іншою базою —');
    console.log('  порівняйте «база:» вище з рядком «база:» у терміналі API (oblik-api).\n');
    if (dropMfa) console.log('  Вхід з кодом вимкнено — система запропонує налаштувати його знову.\n');
    else if (user.mfaEnabledAt) console.log('  Вхід з кодом лишився. Немає телефона — додайте --mfa.\n');
  } finally {
    await db.destroy();
  }
}

void resetPassword();
