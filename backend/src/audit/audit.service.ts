import { Global, Injectable, Module } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import type { AuditAction } from '../shared/interfaces/common.interface.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { maskDiff } from './utils/audit.utils.js';
import { NIL_UUID } from '../common/constants/common.constants.js';

/** Audit log of actions with personal data: who viewed / changed / exported what and when. */
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
