/**
 * Local test accounts — one per role, all with the same password (TEST_ACCOUNTS_PASSWORD, default in
 * test-accounts.constants.ts), and a second demo legal entity «Демо Б» with two fictional employees,
 * to check that every role sees only its legal entity:
 *
 *   npm run seed:accounts
 *
 * Safe to repeat: existing test accounts get the test password, are turned on, unlocked and put back into
 * their legal entity. Never runs in production (NODE_ENV=production).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../config/env.js';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { User } from '../users/user.entity.js';
import { BCRYPT_ROUNDS } from '../users/users.constants.js';
import { UsersService } from '../users/users.service.js';
import { DEMO_ENTITY_B, TEST_ACCOUNTS, TEST_ACCOUNTS_PASSWORD } from './test-accounts.constants.js';

async function seedTestAccounts() {
  if (loadEnv().isProduction) {
    console.error('Тестові облікові записи не створюються в production.');
    process.exitCode = 1;
    return;
  }
  const password = process.env.TEST_ACCOUNTS_PASSWORD || TEST_ACCOUNTS_PASSWORD;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const usersRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const entitiesRepo = app.get<Repository<LegalEntity>>(getRepositoryToken(LegalEntity));
    const users = app.get(UsersService);
    const entities = app.get(LegalEntitiesService);

    const admin = await users.ensureAdmin(
      process.env.ADMIN_EMAIL ?? 'admin@example.com',
      process.env.ADMIN_PASSWORD ?? 'ChangeMe123!',
      'Адміністратор',
    );
    const actor: AuthUser = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: 'ADMIN',
      legalEntityId: null,
      mustChangePassword: false,
    };

    // legal entity A — the first one (npm run seed creates «Приклад»); B — the demo one
    const [first] = await entitiesRepo.find({ order: { createdAt: 'ASC' }, take: 1 });
    if (!first) {
      console.error('Спершу додайте юрособу: npm run seed (або в «Налаштуваннях»).');
      process.exitCode = 1;
      return;
    }
    const b =
      (await entitiesRepo.findOneBy({ edrpou: DEMO_ENTITY_B.edrpou })) ?? (await entities.create(DEMO_ENTITY_B));
    const entityId = { A: first.id, B: b.id };

    // two fictional employees of B — so there is something the others must not see
    const employees = app.get(EmployeesService);
    if (!(await employees.list({ status: 'all', legalEntityId: b.id })).total) {
      const tcks = await app.get<Repository<Tck>>(getRepositoryToken(Tck)).find({ take: 1 });
      for (const [i, [lastName, firstName, middleName]] of [
        ['Окремий', 'Богдан', 'Ігорович'],
        ['Сторонній', 'Василь', 'Петрович'],
      ].entries()) {
        await employees.create(
          {
            legalEntityId: b.id,
            personnelNumber: `Б-00${i + 1}`,
            gender: 'M',
            lastName,
            firstName,
            middleName,
            birthDate: `199${i}-05-1${i}`,
            position: 'інженер',
            hireDate: '2024-03-01',
            rankCode: 3,
            vos: '106',
            tckId: tcks[0]?.id ?? null,
            militaryDocuments: [{ type: 'військовий квиток', number: `90000${i + 1}` }],
          },
          actor,
        );
      }
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    for (const a of TEST_ACCOUNTS) {
      const legalEntityId = a.entity ? entityId[a.entity] : null;
      const existing = await usersRepo.findOneBy({ email: a.email });
      if (!existing) {
        await users.create(
          { email: a.email, fullName: a.fullName, role: a.role, password, legalEntityId },
          { mustChangePassword: false, silent: true },
        );
        continue;
      }
      // a repeated run: the same password and role, on, unlocked, in its legal entity again
      await usersRepo.update(existing.id, {
        passwordHash: hash,
        role: a.role,
        legalEntityId,
        isActive: true,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
        temporaryPasswordExpiresAt: null,
        tokenVersion: () => '"tokenVersion" + 1',
      });
    }

    const name = (e: LegalEntity) => e.shortName || e.fullName;
    console.log(`\nЮрособа А: ${name(first)}\nЮрособа Б: ${name(b)}\n`);
    console.table([
      {
        email: admin.email,
        роль: 'ADMIN',
        юрособа: 'усі',
        пароль: '(ADMIN_PASSWORD з .env)',
        для_чого: 'головний адміністратор',
      },
      ...TEST_ACCOUNTS.map((a) => ({
        email: a.email,
        роль: a.role,
        юрособа: a.entity ?? '—',
        пароль: password,
        для_чого: a.purpose,
      })),
    ]);
  } finally {
    await app.close();
  }
}

await seedTestAccounts();
