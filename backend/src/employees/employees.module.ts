import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { EmployeeChange } from './entities/employee-change.entity.js';
import { Employee } from './entities/employee.entity.js';
import { FamilyMember } from './entities/family-member.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, FamilyMember, EmployeeChange, AuditLog])],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService, TypeOrmModule],
})
export class EmployeesModule {}
