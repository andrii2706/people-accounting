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
import { MailModule } from './mail/mail.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SignaturesModule } from './signatures/signatures.module.js';
import { StorageModule } from './storage/storage.service.js';
import { UsersModule } from './users/users.module.js';

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
        // у продакшні міграції запускає окреме завдання (Cloud Run Job) перед деплоєм
        migrationsRun: loadEnv().dbMigrationsRun,
      }),
    }),
    AuditModule,
    StorageModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    DictionariesModule,
    MailModule,
    EmployeesModule,
    ReportsModule,
    LettersModule,
    SignaturesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
