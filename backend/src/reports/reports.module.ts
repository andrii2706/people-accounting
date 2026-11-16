import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '../employees/employees.module.js';
import { LegalEntity } from '../legal-entities/legal-entity.entity.js';
import { ListDocumentsService } from './lists/list-documents.service.js';
import { ListSettingsService } from './lists/list-settings.service.js';
import { ListSnapshot } from './lists/list-snapshot.entity.js';
import { ListSnapshotsService } from './lists/list-snapshots.service.js';
import { ListsController } from './lists/lists.controller.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [EmployeesModule, TypeOrmModule.forFeature([ListSnapshot, LegalEntity])],
  controllers: [ReportsController, ListsController],
  providers: [ReportsService, ListDocumentsService, ListSnapshotsService, ListSettingsService],
  exports: [ReportsService, ListSnapshotsService],
})
export class ReportsModule {}
