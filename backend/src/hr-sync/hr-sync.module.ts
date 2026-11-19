import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { HrSyncBatch } from './entities/hr-sync-batch.entity.js';
import { HrSyncSettings } from './entities/hr-sync-settings.entity.js';
import { HrPushController, HrSyncController } from './hr-sync.controller.js';
import { HrSyncService } from './hr-sync.service.js';

/** Employees from 1C / BAS (ЗУП, Бухгалтерія): push with a key or OData reading, daily and by hand. */
@Module({
  imports: [TypeOrmModule.forFeature([HrSyncSettings, HrSyncBatch, Tck, LegalEntity]), EmployeesModule],
  providers: [HrSyncService],
  controllers: [HrSyncController, HrPushController],
  exports: [HrSyncService],
})
export class HrSyncModule {}
