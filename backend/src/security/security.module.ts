import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../employees/entities/audit-log.entity.js';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import { User } from '../users/user.entity.js';
import { ExportUsage } from './entities/export-usage.entity.js';
import { SecurityEvent } from './entities/security-event.entity.js';
import { UserDevice } from './entities/user-device.entity.js';
import { ExportInterceptor } from './export.interceptor.js';
import { SecurityController } from './security.controller.js';
import { SecurityService } from './security.service.js';
import { UploadGuardService } from './upload-guard.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent, UserDevice, ExportUsage, AuditLog, User, OutgoingLetter, LetterSignature]),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, UploadGuardService, { provide: APP_INTERCEPTOR, useClass: ExportInterceptor }],
  exports: [SecurityService, UploadGuardService],
})
export class SecurityModule {}
