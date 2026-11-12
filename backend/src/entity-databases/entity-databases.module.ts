import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityDatabase } from './entity-database.entity.js';
import { EntityDatabasesController } from './entity-databases.controller.js';
import { EntityDatabasesService } from './entity-databases.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EntityDatabase])],
  providers: [EntityDatabasesService],
  controllers: [EntityDatabasesController],
})
export class EntityDatabasesModule {}
