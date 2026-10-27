import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { EmployeeChange } from './entities/employee-change.entity.js';
import { Employee } from './entities/employee.entity.js';
import { FamilyMember } from './entities/family-member.entity.js';
import { EmployeeImportController } from './import/employee-import.controller.js';
import { EmployeeImportService } from './import/employee-import.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, FamilyMember, EmployeeChange, AuditLog, Tck])],
  // the import controller first: its fixed paths (employees/import/…) must not be taken by employees/:id
  controllers: [EmployeeImportController, EmployeesController],
  providers: [EmployeesService, EmployeeImportService],
  exports: [EmployeesService, TypeOrmModule],
})
export class EmployeesModule {}
