import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity.js';
import { OrganizationModule } from '../organization/organization.module.js';
import { LegalEntitiesController } from './legal-entities.controller.js';
import { LegalEntitiesService } from './legal-entities.service.js';
import { LegalEntityAccessService } from './legal-entity-access.service.js';
import { UsersModule } from '../users/users.module.js';
import { LegalEntity } from './legal-entity.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LegalEntity, Employee]), OrganizationModule, UsersModule],
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService, LegalEntityAccessService],
  exports: [LegalEntitiesService],
})
export class LegalEntitiesModule {}
