import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { AuthUser } from '../common/auth.js';
import { AuditLog } from '../employees/entities/audit-log.entity.js';

/** Поля, значення яких не потрапляють у журнал відкрито. */
const SENSITIVE = new Set([
  'rnokpp', 'passportSeries', 'passportNumber', 'foreignPassportSeries', 'foreignPassportNumber',
  'militaryDocNumber', 'registryNumber', 'passwordHash', 'password',
]);

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function mask(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return value;
  const s = String(value);
  return s.length <= 2 ? '•••' : `•••${s.slice(-2)}`;
}

export function maskDiff(diff: Record<string, [unknown, unknown]>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, [a, b]] of Object.entries(diff)) out[k] = SENSITIVE.has(k) ? [mask(a), mask(b)] : [a, b];
  return out;
}

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'DISMISS' | 'VIEW' | 'EXPORT' | 'SEND' | 'SIGN'
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOCKED' | 'LOGOUT' | 'PASSWORD_CHANGED' | 'PASSWORD_RESET' | 'USER_UPDATED';

/** Журнал дій з персональними даними: хто, коли, що переглянув/змінив/вивантажив. */
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  log(
    entity: string,
    entityId: string | null,
    action: AuditAction,
    diff: Record<string, [unknown, unknown]> = {},
    user?: Pick<AuthUser, 'id' | 'fullName'> | null,
    manager?: EntityManager,
  ) {
    const repo = manager?.getRepository(AuditLog) ?? this.repo;
    return repo.save({
      entity,
      entityId: entityId ?? NIL_UUID,
      action,
      diff: maskDiff(diff),
      userId: user?.id ?? null,
      userName: user?.fullName ?? '',
    });
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
