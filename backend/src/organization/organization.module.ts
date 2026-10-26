import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationController } from './organization.controller.js';
import { Organization } from './organization.entity.js';
import { OrganizationService } from './organization.service.js';
import { ResponsiblePerson } from './responsible-person.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organization, ResponsiblePerson])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
