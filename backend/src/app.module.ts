import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.service.js';
import { AuthModule } from './auth/auth.module.js';
import { loadEnv, validateEnv } from './config/env.js';
import { Public } from './common/auth.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { DictionariesModule } from './dictionaries/dictionaries.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { LettersModule } from './letters/letters.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SignaturesModule } from './signatures/signatures.module.js';
import { StorageModule } from './storage/storage.service.js';
import { UsersModule } from './users/users.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...buildDataSourceOptions(process.env),
        // in production migrations are run by a separate Cloud Run Job before deployment
        migrationsRun: loadEnv().dbMigrationsRun,
      }),
    }),
    AuditModule,
    NotificationsModule,
    StorageModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    DictionariesModule,
    EmployeesModule,
    ReportsModule,
    LettersModule,
    SignaturesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
