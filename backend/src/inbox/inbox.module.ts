import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeChange } from '../employees/entities/employee-change.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { InboxRead } from './inbox-read.entity.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, EmployeeChange, InboxRead])],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
